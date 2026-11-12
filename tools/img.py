#!/usr/bin/env python3
"""Generate an image with MiniMax image-01 (default) or Gemini, optionally from a reference image.

  python3 tools/img.py out.png "prompt" [ref.png ...] [--aspect 9:16] [--provider minimax|gemini] [--model NAME]
  python3 tools/img.py --list                         # Gemini image models on this key

Keys: MINIMAX_API_KEY / GEMINI_API_KEY in env or mensetsu-video/.env (never printed).
MiniMax uses the first ref as a character reference (subject_reference).
"""
import base64, json, mimetypes, os, pathlib, sys, urllib.error, urllib.request

ROOT = pathlib.Path(__file__).resolve().parent.parent
API = "https://generativelanguage.googleapis.com/v1beta"
MODEL = os.environ.get("GEMINI_IMAGE_MODEL", "gemini-2.5-flash-image")
MINIMAX_IMAGE_URL = os.environ.get("MINIMAX_IMAGE_URL", "https://api.minimax.io/v1/image_generation")


def key(name="GEMINI_API_KEY"):
    k = os.environ.get(name, "")
    env = ROOT / ".env"
    if not k and env.exists():
        for line in env.read_text().splitlines():
            if line.startswith(name + "="):
                k = line.split("=", 1)[1].strip()
    if not k:
        sys.exit(f"{name} belum diisi di .env")
    return k


def data_uri(path):
    mime = mimetypes.guess_type(path)[0] or "image/png"
    return f"data:{mime};base64," + base64.b64encode(pathlib.Path(path).read_bytes()).decode()


def generate_minimax(out, prompt, refs, aspect):
    body = {"model": "image-01", "prompt": prompt, "aspect_ratio": aspect, "response_format": "base64",
            "n": 1, "prompt_optimizer": False}
    if refs:
        body["subject_reference"] = [{"type": "character", "image_file": data_uri(refs[0])}]
    req = urllib.request.Request(MINIMAX_IMAGE_URL, data=json.dumps(body).encode(),
                                 headers={"Authorization": f"Bearer {key('MINIMAX_API_KEY')}", "Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=180) as r:
            res = json.load(r)
    except urllib.error.HTTPError as e:
        sys.exit(f"HTTP {e.code}: {e.read().decode()[:600]}")
    images = (res.get("data") or {}).get("image_base64") or []
    if not images:
        sys.exit("no image: " + json.dumps(res.get("base_resp", res))[:600])
    pathlib.Path(out).parent.mkdir(parents=True, exist_ok=True)
    pathlib.Path(out).write_bytes(base64.b64decode(images[0]))
    print("wrote", out)


def call(path, body=None):
    req = urllib.request.Request(API + path, headers={"x-goog-api-key": key(), "Content-Type": "application/json"},
                                 data=json.dumps(body).encode() if body else None)
    try:
        with urllib.request.urlopen(req, timeout=180) as r:
            return json.load(r)
    except urllib.error.HTTPError as e:
        sys.exit(f"HTTP {e.code}: {e.read().decode()[:600]}")


def list_models():
    models = call("/models?pageSize=200")["models"]
    for m in models:
        if "image" in m["name"] or "imagen" in m["name"]:
            print(m["name"].split("/")[-1], "·", ",".join(m.get("supportedGenerationMethods", [])))


def generate(out, prompt, refs, aspect, model):
    parts = [{"text": prompt}]
    for ref in refs:
        mime = mimetypes.guess_type(ref)[0] or "image/png"
        parts.append({"inline_data": {"mime_type": mime, "data": base64.b64encode(pathlib.Path(ref).read_bytes()).decode()}})
    body = {"contents": [{"parts": parts}],
            "generationConfig": {"responseModalities": ["IMAGE"], "imageConfig": {"aspectRatio": aspect}}}
    res = call(f"/models/{model}:generateContent", body)
    for p in res.get("candidates", [{}])[0].get("content", {}).get("parts", []):
        data = p.get("inlineData") or p.get("inline_data")
        if data:
            pathlib.Path(out).parent.mkdir(parents=True, exist_ok=True)
            pathlib.Path(out).write_bytes(base64.b64decode(data["data"]))
            print("wrote", out)
            return
    sys.exit("no image in response: " + json.dumps(res)[:600])


if __name__ == "__main__":
    args = sys.argv[1:]
    if not args or args[0] == "--list":
        list_models()
        sys.exit()
    opt = {"--aspect": "9:16", "--model": MODEL, "--provider": "minimax"}
    for flag in list(opt):
        if flag in args:
            i = args.index(flag)
            opt[flag] = args[i + 1]
            del args[i:i + 2]
    if opt["--provider"] == "minimax":
        generate_minimax(args[0], args[1], args[2:], opt["--aspect"])
    else:
        generate(args[0], args[1], args[2:], opt["--aspect"], opt["--model"])
