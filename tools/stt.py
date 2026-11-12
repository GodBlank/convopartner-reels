#!/usr/bin/env python3
"""stt.py <file.wav> — transcribe a voice file with ElevenLabs Scribe to check what was really spoken.

Sarah v3 sometimes drops words (it read "dua puluh enam juta" as "dua puluh enam"), so check numbers and key
words in hooks before rendering. Uses the same ELEVENLABS_API_KEY / _2 … _9 rotation as tts.py.
"""
import json, os, sys, urllib.error, urllib.request, uuid

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def keys():
    out = []
    env = os.path.join(ROOT, ".env")
    for line in open(env, encoding="utf-8") if os.path.exists(env) else []:
        if line.startswith("ELEVENLABS_API_KEY"):
            out.append(line.split("=", 1)[1].strip().strip('"').strip("'"))
    return out or [os.environ.get("ELEVENLABS_API_KEY", "")]


def main():
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    data = open(sys.argv[1], "rb").read()
    b = uuid.uuid4().hex
    body = (f"--{b}\r\nContent-Disposition: form-data; name=\"model_id\"\r\n\r\nscribe_v1\r\n"
            f"--{b}\r\nContent-Disposition: form-data; name=\"file\"; filename=\"a.wav\"\r\nContent-Type: audio/wav\r\n\r\n").encode() + data + f"\r\n--{b}--\r\n".encode()
    for i, k in enumerate(keys(), 1):
        req = urllib.request.Request("https://api.elevenlabs.io/v1/speech-to-text", data=body,
                                     headers={"xi-api-key": k, "Content-Type": f"multipart/form-data; boundary={b}"})
        try:
            print(json.load(urllib.request.urlopen(req, timeout=120))["text"])
            return
        except urllib.error.HTTPError as e:
            print(f"key #{i}: HTTP {e.code}", file=sys.stderr)
    sys.exit("all keys failed")


if __name__ == "__main__":
    main()
