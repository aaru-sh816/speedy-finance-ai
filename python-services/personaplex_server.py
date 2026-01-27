import os
import sys
import asyncio
import torch
import sentencepiece
import sphn
import numpy as np
import aiohttp
from aiohttp import web
from datetime import datetime
import json
import logging
import argparse
from huggingface_hub import hf_hub_download

# Add moshi to sys.path
current_dir = os.path.dirname(os.path.abspath(__file__))
moshi_path = os.path.join(current_dir, "personaplex", "moshi")
if moshi_path not in sys.path:
    sys.path.append(moshi_path)

from moshi.models import loaders, MimiModel, LMModel, LMGen
from moshi.utils.logging import setup_logger, ColorizedLog
from bulk_deals_database import BulkDealsDatabase

logger = setup_logger(__name__)

# Personas
FINANCIAL_ANALYST_PROMPT = """You are the Lead Quantitative Analyst for Speedy Finance. 
You provide deep, data-driven insights into the Indian stock market (BSE and NSE).
Your tone is professional, institutional-grade, yet helpful and concise.
You have real-time access to bulk deals, company announcements, and market trends.
When discussing specific stocks, use the provided live data to be as accurate as possible.
You handle interruptions gracefully and stay focused on financial analysis.
Your name is Alex."""

def wrap_with_system_tags(text: str) -> str:
    cleaned = text.strip()
    if cleaned.startswith("<system>") and cleaned.endswith("<system>"):
        return cleaned
    return f"<system> {cleaned} <system>"

class SpeedyFinanceServerState:
    def __init__(self, device: str | torch.device, voice_prompt_dir: str | None = None):
        self.device = device
        self.voice_prompt_dir = voice_prompt_dir
        self.mimi = None
        self.other_mimi = None
        self.text_tokenizer = None
        self.lm_gen = None
        self.status = "syncing"
        self.progress = 0
        self.db = BulkDealsDatabase()
        self.lock = asyncio.Lock()

    def set_models(self, mimi, other_mimi, tokenizer, lm):
        self.mimi = mimi
        self.other_mimi = other_mimi
        self.text_tokenizer = tokenizer
        self.frame_size = int(self.mimi.sample_rate / self.mimi.frame_rate)
        self.lm_gen = LMGen(lm,
                            audio_silence_frame_cnt=int(0.5 * self.mimi.frame_rate),
                            sample_rate=self.mimi.sample_rate,
                            device=self.device,
                            frame_rate=self.mimi.frame_rate)
        
        self.mimi.streaming_forever(1)
        self.other_mimi.streaming_forever(1)
        self.lm_gen.streaming_forever(1)
        self.status = "ready"

    def get_live_context(self):
        """Fetch latest bulk deals to ground the persona."""
        try:
            deals = self.db.get_all_deals()
            # Get latest 10 deals for context
            latest_deals = sorted(deals, key=lambda x: x.get('date', ''), reverse=True)[:10]
            
            context = "\nRecent Bulk Deals Context:\n"
            for deal in latest_deals:
                context += f"- {deal.get('date')}: {deal.get('clientName')} {deal.get('side')} {deal.get('quantity')} shares of {deal.get('securityName')} at ₹{deal.get('price')} on {deal.get('exchange')}\n"
            
            return context
        except Exception as e:
            logger.error(f"Error fetching live context: {e}")
            return ""

    async def handle_status(self, request):
        return web.json_response({
            "status": self.status,
            "progress": self.progress,
            "timestamp": datetime.now().isoformat()
        })

    async def handle_chat(self, request):
        if self.status != "ready":
            return web.Response(status=503, text="Neural link is still syncing...")

        ws = web.WebSocketResponse()
        await ws.prepare(request)
        clog = ColorizedLog.randomize()
        peer = request.remote
        clog.log("info", f"Incoming voice connection from {peer}")

        # Get dynamic context
        live_data = self.get_live_context()
        full_prompt = FINANCIAL_ANALYST_PROMPT + live_data
        
        # Load voice prompt (default to NATM1 for Analyst)
        voice_prompt_filename = request.query.get("voice_prompt", "NATM1.pt")
        voice_prompt_path = os.path.join(self.voice_prompt_dir, voice_prompt_filename)
        
        if not os.path.exists(voice_prompt_path):
            # Fallback to any available .pt file if NATM1 is missing
            pts = [f for f in os.listdir(self.voice_prompt_dir) if f.endswith('.pt')]
            if pts:
                voice_prompt_path = os.path.join(self.voice_prompt_dir, pts[0])
            else:
                return web.Response(status=500, text="No voice prompts available")

        # Set up LM Gen with dynamic prompt
        async with self.lock:
            if self.lm_gen.voice_prompt != voice_prompt_path:
                if voice_prompt_path.endswith('.pt'):
                    self.lm_gen.load_voice_prompt_embeddings(voice_prompt_path)
                else:
                    self.lm_gen.load_voice_prompt(voice_prompt_path)
            
            self.lm_gen.text_prompt_tokens = self.text_tokenizer.encode(wrap_with_system_tags(full_prompt))
            
            self.mimi.reset_streaming()
            self.other_mimi.reset_streaming()
            self.lm_gen.reset_streaming()

            close = False
            
            async def is_alive():
                return not (close or ws.closed)

            # System prompt handshake
            await self.lm_gen.step_system_prompts_async(self.mimi, is_alive=is_alive)
            self.mimi.reset_streaming()
            await ws.send_bytes(b"\x00") # Handshake done

            opus_writer = sphn.OpusWriter(self.mimi.sample_rate)
            opus_reader = sphn.OpusReader(self.mimi.sample_rate)

            async def recv_loop():
                nonlocal close
                try:
                    async for message in ws:
                        if message.type == aiohttp.WSMsgType.BINARY:
                            if message.data[0] == 1: # Audio kind
                                opus_reader.append_bytes(message.data[1:])
                        elif message.type in (aiohttp.WSMsgType.CLOSED, aiohttp.WSMsgType.CLOSE):
                            break
                finally:
                    close = True

            async def process_loop():
                all_pcm_data = None
                while not close:
                    await asyncio.sleep(0.005)
                    pcm = opus_reader.read_pcm()
                    if pcm.shape[-1] == 0:
                        continue
                    
                    if all_pcm_data is None:
                        all_pcm_data = pcm
                    else:
                        all_pcm_data = np.concatenate((all_pcm_data, pcm))
                    
                    while all_pcm_data.shape[-1] >= self.frame_size:
                        chunk = all_pcm_data[:self.frame_size]
                        all_pcm_data = all_pcm_data[self.frame_size:]
                        chunk_t = torch.from_numpy(chunk).to(self.device)[None, None]
                        
                        codes = self.mimi.encode(chunk_t)
                        self.other_mimi.encode(chunk_t)
                        
                        for c in range(codes.shape[-1]):
                            tokens = self.lm_gen.step(codes[:, :, c : c+1])
                            if tokens is None: continue
                            
                            # Decode audio
                            out_pcm = self.mimi.decode(tokens[:, 1:9]).cpu()
                            self.other_mimi.decode(tokens[:, 1:9])
                            opus_writer.append_pcm(out_pcm[0, 0].numpy())
                            
                            # Stream text tokens (if any)
                            text_token = tokens[0, 0, 0].item()
                            if text_token not in (0, 3): # Not PAD/EOS
                                _text = self.text_tokenizer.id_to_piece(text_token).replace("▁", " ")
                                await ws.send_bytes(b"\x02" + _text.encode("utf-8"))

            async def send_loop():
                while not close:
                    await asyncio.sleep(0.005)
                    audio_bytes = opus_writer.read_bytes()
                    if audio_bytes:
                        await ws.send_bytes(b"\x01" + audio_bytes)

            # Run loops
            await asyncio.gather(recv_loop(), process_loop(), send_loop())
            clog.log("info", "Session ended")
            
        return ws

async def load_weights_async(state, args):
    try:
        logger.info("Starting PersonaPlex weights download...")
        # Note: hf_hub_download is synchronous, but we run it in a thread or just let it block the background task
        mimi_weight = hf_hub_download(args.hf_repo, loaders.MIMI_NAME)
        state.progress = 30
        moshi_weight = hf_hub_download(args.hf_repo, loaders.MOSHI_NAME)
        state.progress = 80
        tokenizer_path = hf_hub_download(args.hf_repo, loaders.TEXT_TOKENIZER_NAME)
        state.progress = 90
        
        # Download voices
        from moshi.server import _get_voice_prompt_dir
        voice_dir = _get_voice_prompt_dir(None, args.hf_repo)
        state.voice_prompt_dir = voice_dir

        logger.info("Initializing models on device...")
        mimi = loaders.get_mimi(mimi_weight, args.device)
        other_mimi = loaders.get_mimi(mimi_weight, args.device)
        lm = loaders.get_moshi_lm(moshi_weight, args.device)
        lm.eval()
        tokenizer = sentencepiece.SentencePieceProcessor(tokenizer_path)

        state.set_models(mimi, other_mimi, tokenizer, lm)
        logger.info("PersonaPlex is READY.")
    except Exception as e:
        logger.error(f"Failed to load weights: {e}")
        state.status = "error"

async def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", default=8998, type=int)
    parser.add_argument("--device", default="cuda" if torch.cuda.is_available() else "cpu")
    parser.add_argument("--hf-repo", default="kyutai/moshiko-pytorch-bf16")
    args, _ = parser.parse_known_args()

    state = SpeedyFinanceServerState(args.device)
    
    app = web.Application()
    app.router.add_get("/api/chat", state.handle_chat)
    app.router.add_get("/api/status", state.handle_status)
    
    logger.info(f"Speedy Finance Status Server starting on port {args.port}")
    runner = web.AppRunner(app)
    await runner.setup()
    site = web.TCPSite(runner, '0.0.0.0', args.port)
    await site.start()
    
    # Load weights in background
    asyncio.create_task(load_weights_async(state, args))
    
    # Keep alive
    while True:
        await asyncio.sleep(3600)

if __name__ == "__main__":
    asyncio.run(main())
