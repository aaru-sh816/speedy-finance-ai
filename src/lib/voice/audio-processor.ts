// @ts-nocheck
class MoshiProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    
    this.initialBufferSamples = 128 * 10; // wait for 10 frames
    this.maxBufferSamples = 128 * 100;   // drop frames if too many
    
    this.initState();

    this.port.onmessage = (event) => {
      if (event.data.type === "reset") {
        this.initState();
        return;
      }
      let frame = event.data.frame;
      this.frames.push(frame);
      if (this.currentSamples() >= this.initialBufferSamples && !this.started) {
        this.start();
      }
      
      if (this.currentSamples() >= this.maxBufferSamples) {
        // Drop oldest packets
        while (this.currentSamples() > this.initialBufferSamples) {
          this.frames.shift();
        }
      }
    };
  }

  initState() {
    this.frames = [];
    this.offsetInFirstBuffer = 0;
    this.started = false;
    this.totalAudioPlayed = 0;
  }

  currentSamples() {
    let samples = 0;
    for (let k = 0; k < this.frames.length; k++) {
      samples += this.frames[k].length;
    }
    samples -= this.offsetInFirstBuffer;
    return samples;
  }

  start() {
    this.started = true;
  }

  process(inputs, outputs, parameters) {
    const output = outputs[0][0];
    if (!this.started || this.frames.length === 0) {
      return true;
    }

    let out_idx = 0;
    while (out_idx < output.length && this.frames.length) {
      let first = this.frames[0];
      let to_copy = Math.min(first.length - this.offsetInFirstBuffer, output.length - out_idx);
      output.set(first.subarray(this.offsetInFirstBuffer, this.offsetInFirstBuffer + to_copy), out_idx);
      this.offsetInFirstBuffer += to_copy;
      out_idx += to_copy;
      if (this.offsetInFirstBuffer === first.length) {
        this.offsetInFirstBuffer = 0;
        this.frames.shift();
      }
    }

    return true;
  }
}

registerProcessor("moshi-processor", MoshiProcessor);
