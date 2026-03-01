import os
import sys

# Ensure moshi package is available
current_dir = os.path.dirname(os.path.abspath(__file__))
moshi_path = os.path.join(current_dir, "personaplex", "moshi")
if moshi_path not in sys.path:
    sys.path.append(moshi_path)


def load_hf_token_from_env_file() -> None:
    if os.environ.get("HF_TOKEN"):
        return
    env_path = os.path.abspath(os.path.join(current_dir, "..", ".env.local"))
    if not os.path.exists(env_path):
        return
    try:
        with open(env_path, "r", encoding="utf-8") as handle:
            for line in handle:
                line = line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                key, value = line.split("=", 1)
                if key.strip() == "HF_TOKEN":
                    value = value.strip().strip('"').strip("'")
                    if value:
                        os.environ["HF_TOKEN"] = value
                    break
    except Exception:
        return


load_hf_token_from_env_file()

import asyncio
from moshi.speedy_server import main


if __name__ == "__main__":
    asyncio.run(main())
