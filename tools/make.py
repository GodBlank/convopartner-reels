#!/usr/bin/env python3
"""make.py <episode-id> [minimax|eleven|gemini|say] — voice the script, then render out/<id>.mp4 (Mac, Windows, Linux).

    python tools/make.py tukar-hidup eleven
"""
import os, subprocess, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "tools"))
from tts import find_ffmpeg  # noqa: E402


def main():
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    eid, provider = sys.argv[1], (sys.argv[2] if len(sys.argv) > 2 else "minimax")
    os.chdir(ROOT)
    subprocess.run([sys.executable, os.path.join("tools", "tts.py"), os.path.join("episodes", f"{eid}.json"), "--provider", provider], check=True)
    out = os.path.join("out", f"{eid}.mp4")
    npx = "npx.cmd" if os.name == "nt" else "npx"
    subprocess.run([npx, "remotion", "render", "Mensetsu", out, f'--props={{"episode":"{eid}"}}', "--concurrency=4", "--log=error"], check=True)
    # social-media loudness (-14 LUFS), video stream copied untouched
    tmp = os.path.join("out", f"{eid}.tmp.mp4")
    subprocess.run([find_ffmpeg(), "-v", "error", "-y", "-i", out, "-c:v", "copy", "-af", "loudnorm=I=-14:TP=-1.5:LRA=11", "-c:a", "aac", "-b:a", "192k", tmp], check=True)
    os.replace(tmp, out)
    print(f"done: {out}")


if __name__ == "__main__":
    main()
