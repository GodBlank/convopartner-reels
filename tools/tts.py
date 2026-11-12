#!/usr/bin/env python3
"""tts.py — voice an episode script and write the Remotion timeline.

    python3 tools/tts.py episodes/<id>.json [--provider gemini|say]

One audio file per beat (so captions sync per line), cached by content hash.
MiniMax "flow" (default on, episode "flow": false to disable): consecutive Indonesian lines of the same voice are
spoken in ONE request with <#0.4#> pauses between them, so the intonation carries across lines like real speech,
then cut back into per-beat files at the subtitle timestamps MiniMax returns.
Writes public/episodes/<id>/timeline.json, which the "Mensetsu" composition reads.

Providers:
  gemini  Gemini 3.8 Flash-Lite TTS through treg (~$0.035 per line). Natural Indonesian + Japanese.
  minimax MiniMax speech-2.8-hd (t2a_v2). Native Indonesian + Japanese voices. Needs MINIMAX_API_KEY
          in the environment or in mensetsu-video/.env (key from platform.minimax.io → API Keys).
  eleven  ElevenLabs (ELEVENLABS_API_KEY). Default Sarah on eleven_v3 (premade, works on the free tier;
          free tier = non-commercial). Library voices need a paid plan. Flows paragraphs like MiniMax,
          split at the character timestamps from /with-timestamps.
  say     macOS `say` (Damayanti / Kyoko, pitch-shifted per character). Free, robotic: drafts only.
"""
import argparse, base64, hashlib, json, math, os, re, shutil, subprocess, sys, threading, urllib.error, urllib.request, wave
from concurrent.futures import ThreadPoolExecutor

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PUBLIC = os.path.join(ROOT, "public")


def find_ffmpeg():
    """$FFMPEG, then the project's ffmpeg-static (npm install), then ffmpeg on PATH."""
    exe = "ffmpeg.exe" if os.name == "nt" else "ffmpeg"
    for c in (os.environ.get("FFMPEG"), os.path.join(ROOT, "node_modules", "ffmpeg-static", exe), shutil.which("ffmpeg")):
        if c and os.path.exists(c):
            return c
    raise RuntimeError("ffmpeg not found: run `npm install` in mensetsu-video, or install ffmpeg and put it on PATH")


FF = find_ffmpeg()
TREG = os.path.expanduser("~/.local/bin/treg")
FPS = 30
GAP = 0.2  # silence after each spoken beat, seconds
MAX_SECONDS = 60

CJK = re.compile(r"[぀-ヿ㐀-鿿]")

GEMINI = {
    "interviewer": ("Kore", "confident young woman playing a strict Japanese interviewer, crisp, energetic, a little sassy, clear"),
    "candidate": ("Puck", "young Indonesian job applicant, a bit nervous, natural and sincere"),
    "candidate_female": ("Leda", "young Indonesian job applicant, a bit nervous, natural and sincere"),
}
# voice_id per character; the same voice speaks both languages, language_boost picks per line
MINIMAX = {
    "interviewer": "Indonesian_ConfidentWoman",
    "candidate": "Indonesian_DeterminedBoy",
    "candidate_female": "Indonesian_CharmingGirl",
}
MINIMAX_MODEL = "speech-2.8-hd"
# (voice_id, model) per character
ELEVEN = {
    "interviewer": ("EXAVITQu4vr4xnSDxMaL", "eleven_v3"),  # Sarah
    "candidate": ("TX3LPaxmHKxFdv7VOQHJ", "eleven_v3"),  # Liam
    "candidate_female": ("cgSgspJ2msm6clMCkdW9", "eleven_v3"),  # Jessica
}
# story characters' own lines (a bubble with "voice"): MiniMax system voices, native Japanese for Japanese people,
# Indonesian voices speaking Japanese (natural accent) for Rina/Dimas. Any raw MiniMax voice_id works too.
LINE_VOICES = {
    "dimas": "Indonesian_DeterminedBoy",
    "rina": "Indonesian_SweetGirl",
    "pemuda": "Japanese_SportyStudent",
    "pria": "Japanese_IntellectualSenior",
    "atasan": "Japanese_DominantMan",
    "koki": "Japanese_GenerousIzakayaOwner",
    "wanita": "Japanese_KindLady",
    "nenek": "Japanese_CalmLady",
    "tanaka": "Japanese_SportyStudent",
    "ibu": "Indonesian_CalmWoman",
}
MINIMAX_URL = "https://api.minimax.io/v1/t2a_v2"  # mainland-China accounts: https://api.minimaxi.com/v1/t2a_v2
# (id voice, ja voice, pitch factor)
SAY = {
    "interviewer": ("Damayanti", "Kyoko", 1.04),
    "candidate": ("Damayanti", "Kyoko", 0.84),
    "candidate_female": ("Damayanti", "Kyoko", 0.95),
}


def run(cmd, **kw):
    r = subprocess.run(cmd, capture_output=True, text=True, **kw)
    if r.returncode != 0:
        raise RuntimeError(f"{cmd[0]} failed: {(r.stderr or r.stdout)[-600:]}")
    return r.stdout


def web(path):
    """Path under public/ as Remotion's staticFile wants it: forward slashes on every OS."""
    return os.path.relpath(path, PUBLIC).replace(os.sep, "/")


def strip(s):
    return re.sub(r"[*~+]", "", s or "").strip()


def spoken(b):
    if b.get("silent"):
        return ""
    if b.get("speak"):
        return b["speak"]
    if b.get("say"):
        return strip(b["say"])
    if b.get("jp"):
        return b["jp"]["text"]
    if b.get("cta"):
        return f"Komen {b['cta']['word']}. {strip(b['cta'].get('line', ''))}".strip()
    if b.get("end"):
        e = b["end"]
        return " ".join(strip(x) for x in (e.get("headline"), e.get("cta")) if x)
    return ""


def gemini(text, voice, style, path):
    body = {
        "contents": [{"parts": [{"text": text, "speechMetadata": {"style": style}}]}],
        "generationConfig": {
            "responseModalities": ["AUDIO"],
            "speechConfig": {"voiceConfig": {"prebuiltVoiceConfig": {"voiceName": voice}}},
        },
    }
    out = run([TREG, "call", "google-ai.voice-gen.gemini-3-8-flash-lite-tts", "--method", "POST",
               "--query", "model=gemini-3.8-flash-lite-tts", "--data", json.dumps(body)])
    m = re.search(r'"data"\s*:\s*"([A-Za-z0-9+/=]{200,})"', out)
    if not m:
        raise RuntimeError("TTS returned no audio: " + out[:300])
    raw = base64.b64decode(m.group(1))
    if raw[:4] != b"RIFF":  # bare PCM16 24 kHz mono -> wrap in WAV
        with wave.open(path, "wb") as w:
            w.setnchannels(1); w.setsampwidth(2); w.setframerate(24000); w.writeframes(raw)
    else:
        open(path, "wb").write(raw)


def env_key(name):
    key = os.environ.get(name)
    env = os.path.join(ROOT, ".env")
    if not key and os.path.exists(env):
        for line in open(env):
            if line.strip().startswith(name + "="):
                key = line.split("=", 1)[1].strip().strip('"').strip("'")
    if not key:
        raise RuntimeError(f"{name} not set (put {name}=... in mensetsu-video/.env)")
    return key


def eleven_keys():
    """ELEVENLABS_API_KEY, then ELEVENLABS_API_KEY_2 … _9 — whichever are set."""
    names = ["ELEVENLABS_API_KEY"] + [f"ELEVENLABS_API_KEY_{n}" for n in range(2, 10)]
    keys = []
    for name in names:
        try:
            keys.append(env_key(name))
        except RuntimeError:
            pass
    if not keys:
        raise RuntimeError("ELEVENLABS_API_KEY not set (put ELEVENLABS_API_KEY=... in mensetsu-video/.env)")
    return keys


ELEVEN_KEY = {"i": 0}  # current key; moves on for good once a key runs out of credits
ELEVEN_LOCK = threading.Lock()


def eleven_post(url, body):
    """POST to ElevenLabs, switching to the next key in .env when one is out of credits."""
    keys = eleven_keys()
    while True:
        i = ELEVEN_KEY["i"]
        if i >= len(keys):
            raise RuntimeError("ElevenLabs: all API keys are out of credits")
        req = urllib.request.Request(url, data=json.dumps(body).encode(),
                                     headers={"xi-api-key": keys[i], "Content-Type": "application/json"})
        try:
            with urllib.request.urlopen(req, timeout=180) as r:
                return json.load(r)
        except urllib.error.HTTPError as e:
            msg = e.read().decode()[:300]
            if e.code in (401, 402) and ("quota" in msg or "credit" in msg):
                with ELEVEN_LOCK:
                    if ELEVEN_KEY["i"] == i:
                        ELEVEN_KEY["i"] = i + 1
                        print(f"  ElevenLabs key #{i + 1} out of credits, switching to key #{i + 2}", flush=True)
                continue
            raise RuntimeError(f"ElevenLabs error {e.code}: {msg}")


def eleven_flow(texts, voice, model, paths):
    """One ElevenLabs request for consecutive lines; cut per line at the character timestamps."""
    full = " ".join(texts)
    body = {"text": full, "model_id": model, "voice_settings": {"stability": 0.5}}
    if not CJK.search(full):
        body["language_code"] = "id"
    res = eleven_post(f"https://api.elevenlabs.io/v1/text-to-speech/{voice}/with-timestamps?output_format=mp3_44100_128", body)
    al = res.get("alignment") or res.get("normalized_alignment")
    tmp = paths[0] + ".full.mp3"
    open(tmp, "wb").write(base64.b64decode(res["audio_base64"]))
    starts, ends = al["character_start_times_seconds"], al["character_end_times_seconds"]
    cuts, pos = [], 0
    for t in texts[:-1]:
        pos += len(t)
        i = min(pos, len(ends) - 1)
        nxt = min(pos + 1, len(starts) - 1)
        cuts.append((ends[i - 1] + starts[nxt]) / 2)
        pos += 1  # the joining space
    edges = [0.0] + cuts + [None]
    for k, path in enumerate(paths):
        cmd = [FF, "-y", "-v", "error", "-i", tmp, "-ss", f"{edges[k]:.3f}"]
        if edges[k + 1] is not None:
            cmd += ["-to", f"{edges[k + 1]:.3f}"]
        run(cmd + ["-ar", "32000", "-ac", "1", "-c:a", "pcm_s16le", path])
    os.remove(tmp)


def minimax_key():
    key = os.environ.get("MINIMAX_API_KEY")
    env = os.path.join(ROOT, ".env")
    if not key and os.path.exists(env):
        for line in open(env):
            if line.strip().startswith("MINIMAX_API_KEY="):
                key = line.split("=", 1)[1].strip().strip('"').strip("'")
    if not key:
        raise RuntimeError("MINIMAX_API_KEY not set (export it, or put MINIMAX_API_KEY=... in mensetsu-video/.env)")
    return key


def minimax(text, voice, emotion, path, speed=1.05):
    body = {
        "model": MINIMAX_MODEL,
        "text": text,
        "stream": False,
        "language_boost": "Japanese" if CJK.search(text) else "Indonesian",
        "output_format": "hex",
        "voice_setting": {"voice_id": voice, "speed": speed, "vol": 1, "pitch": 0},
        "audio_setting": {"sample_rate": 32000, "format": "wav", "channel": 1},
    }
    if emotion:
        body["voice_setting"]["emotion"] = emotion
    req = urllib.request.Request(os.environ.get("MINIMAX_URL", MINIMAX_URL), data=json.dumps(body).encode(),
                                 headers={"Authorization": f"Bearer {minimax_key()}", "Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=120) as r:
        res = json.load(r)
    base = res.get("base_resp", {})
    if base.get("status_code") != 0 or not res.get("data", {}).get("audio"):
        raise RuntimeError(f"MiniMax error {base.get('status_code')}: {base.get('status_msg')}")
    open(path, "wb").write(bytes.fromhex(res["data"]["audio"]))


PAUSE = "<#0.4#>"


def minimax_flow(texts, voice, emotion, paths, speed=1.05):
    """Speak several lines as one paragraph, then split at the pauses using MiniMax's subtitle timings."""
    full = PAUSE.join(texts)
    body = {
        "model": MINIMAX_MODEL,
        "text": full,
        "stream": False,
        "language_boost": "Indonesian",
        "output_format": "hex",
        "subtitle_enable": True,
        "voice_setting": {"voice_id": voice, "speed": speed, "vol": 1, "pitch": 0},
        "audio_setting": {"sample_rate": 32000, "format": "wav", "channel": 1},
    }
    if emotion:
        body["voice_setting"]["emotion"] = emotion
    req = urllib.request.Request(os.environ.get("MINIMAX_URL", MINIMAX_URL), data=json.dumps(body).encode(),
                                 headers={"Authorization": f"Bearer {minimax_key()}", "Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=180) as r:
        res = json.load(r)
    base = res.get("base_resp", {})
    data = res.get("data") or {}
    if base.get("status_code") != 0 or not data.get("audio") or not data.get("subtitle_file"):
        raise RuntimeError(f"MiniMax error {base.get('status_code')}: {base.get('status_msg')}")
    with urllib.request.urlopen(data["subtitle_file"], timeout=60) as r:
        segs = json.load(r)
    tmp = paths[0] + ".full.wav"
    open(tmp, "wb").write(bytes.fromhex(data["audio"]))
    total = duration(tmp)
    # character range of each line inside the joined text
    bounds, pos = [], 0
    for t in texts:
        bounds.append((pos, pos + len(t)))
        pos += len(t) + len(PAUSE)
    # MiniMax's character offsets drift by a char or two after each pause: match each segment by its midpoint
    owner = lambda g: min(range(len(bounds)), key=lambda k: max(bounds[k][0] - (g["text_begin"] + g["text_end"]) / 2,
                                                                  (g["text_begin"] + g["text_end"]) / 2 - bounds[k][1], 0))
    spans = []
    for k in range(len(bounds)):
        mine = [g for g in segs if owner(g) == k]
        if not mine:
            os.remove(tmp)
            raise RuntimeError("MiniMax subtitles did not line up with the lines; set \"flow\": false")
        spans.append([min(g["time_begin"] for g in mine) / 1000, max(g["time_end"] for g in mine) / 1000])
    for k, (path, (a, b)) in enumerate(zip(paths, spans)):
        start = 0 if k == 0 else max(spans[k - 1][1], a - 0.05)
        end = total if k == len(spans) - 1 else min(b + 0.12, spans[k + 1][0])
        run([FF, "-y", "-v", "error", "-i", tmp, "-ss", f"{start:.3f}", "-to", f"{end:.3f}", "-c:a", "pcm_s16le", path])
    os.remove(tmp)


def say(text, voices, path):
    id_voice, ja_voice, pitch = voices
    voice = ja_voice if CJK.search(text) else id_voice
    aiff = path + ".aiff"
    run(["say", "-v", voice, "-r", "185", "-o", aiff, "--file-format=AIFF", "--data-format=BEI16@22050", text])
    run([FF, "-y", "-v", "error", "-i", aiff, "-af",
         f"asetrate={int(22050 * pitch)},aresample=24000,atempo={1 / pitch:.4f}", "-ac", "1", path])
    os.remove(aiff)


def duration(path):
    with wave.open(path) as w:
        return w.getnframes() / w.getframerate()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("script")
    ap.add_argument("--provider", choices=["gemini", "minimax", "eleven", "say"], default="gemini")
    a = ap.parse_args()

    ep = json.load(open(a.script))
    eid = ep["id"]
    cvoice = ep.get("candidate", {}).get("voice", "male")
    adir = os.path.join(PUBLIC, "episodes", eid, "audio")
    os.makedirs(adir, exist_ok=True)

    jobs = []
    for i, b in enumerate(ep["beats"]):
        text = spoken(b)
        if not text:
            continue
        who = b.get("speaker") or "interviewer"
        key = "candidate_female" if who == "candidate" and cvoice == "female" else who
        if a.provider == "gemini":
            cfg = GEMINI[key]
        elif a.provider == "minimax":
            # episode "speed" (MiniMax 0.5–2, default 1.05); only non-default speeds enter the cache key
            speed = float(ep.get("speed", 1.05))
            if CJK.search(text):
                speed = min(speed, 1.05)  # Japanese lines stay clear for learners
            cfg = (MINIMAX[key], b.get("emotion")) + ((speed,) if speed != 1.05 else ())
        elif a.provider == "eleven":
            cfg = ELEVEN[key]
        else:
            cfg = SAY[key]
        h = hashlib.sha1(json.dumps([a.provider, cfg, text]).encode()).hexdigest()[:12]
        jobs.append((i, text, cfg, os.path.join(adir, f"{h}.wav")))

    def voice(job):
        i, text, cfg, path = job
        if not os.path.exists(path):
            if a.provider == "gemini":
                gemini(text, cfg[0], cfg[1], path)
            elif a.provider == "minimax":
                minimax(text, *cfg[:2], path, *cfg[2:])
            elif a.provider == "eleven":
                eleven_flow([text], cfg[0], cfg[1], [path])
            else:
                say(text, cfg, path)
        print(f"  beat {i:02d} {duration(path):5.2f}s  {text[:60]}", flush=True)
        return i, path

    # MiniMax flow: chain consecutive Indonesian beats of the same voice into paragraphs (≤ 5 lines, ≤ 320 chars)
    groups = []
    if a.provider in ("minimax", "eleven") and ep.get("flow", True):
        for job in jobs:
            i, text, cfg, _ = job
            g = groups[-1] if groups else None
            if (g and not CJK.search(text) and not CJK.search(g[-1][1]) and g[-1][2] == cfg and g[-1][0] == i - 1
                    and len(g) < 5 and sum(len(x[1]) for x in g) + len(text) <= 320):
                g.append(job)
            else:
                groups.append([job])
        flowed = []
        for g in groups:
            if len(g) == 1:
                flowed.append(g[0])
                continue
            gh = hashlib.sha1(json.dumps(["flow", a.provider, g[0][2], [x[1] for x in g]]).encode()).hexdigest()[:12]
            flowed.append([(x[0], x[1], x[2], os.path.join(adir, f"{gh}-{k}.wav")) for k, x in enumerate(g)])
        jobs = flowed

    def voice_group(g):
        paths = [x[3] for x in g]
        if not all(os.path.exists(p) for p in paths):
            cfg = g[0][2]
            if a.provider == "eleven":
                eleven_flow([x[1] for x in g], cfg[0], cfg[1], paths)
            else:
                minimax_flow([x[1] for x in g], cfg[0], cfg[1], paths, *cfg[2:])
        for i, text, _, path in g:
            print(f"  beat {i:02d} {duration(path):5.2f}s  {text[:60]}  (flow)", flush=True)
        return [(x[0], x[3]) for x in g]

    def work(job):
        return voice_group(job) if isinstance(job, list) else [voice(job)]

    todo = sum(not os.path.exists(p) for j in jobs for p in ([x[3] for x in j] if isinstance(j, list) else [j[3]]))
    print(f"{eid}: {len(jobs)} TTS requests, {todo} beat files to synthesise with {a.provider}")
    with ThreadPoolExecutor({"say": 1, "eleven": 2}.get(a.provider, 4)) as pool:
        audio = dict(pair for res in pool.map(work, jobs) for pair in res)

    # ElevenLabs has no usable speed knob on v3: episode "tempo" speeds Indonesian lines up afterwards
    # (pitch kept, cached raw takes untouched, so changing it costs no quota)
    tempo = float(ep.get("tempo", 1.0))
    if a.provider == "eleven" and tempo != 1.0:
        for i, path in audio.items():
            if CJK.search(spoken(ep["beats"][i])):
                continue
            fast = path.replace(".wav", f"-t{tempo:g}.wav")
            if not os.path.exists(fast):
                run([FF, "-y", "-v", "error", "-i", path, "-af", f"atempo={tempo}", fast])
            audio[i] = fast

    # character lines: spoken right after the beat's narration, in the character's own voice
    line_jobs = []
    for i, b in enumerate(ep["beats"]):
        for side, bub in ((b.get("duel") or {}).get("bubbles") or {}).items():
            if isinstance(bub, dict) and bub.get("voice"):
                v = LINE_VOICES.get(bub["voice"], bub["voice"])
                sp = float(bub.get("speed", 1.0))
                key = ["line", v, bub.get("emotion"), bub["text"]] + ([sp] if sp != 1.0 else [])
                h = hashlib.sha1(json.dumps(key).encode()).hexdigest()[:12]
                line_jobs.append((i, side, bub["text"], v, bub.get("emotion"), sp, os.path.join(adir, f"line-{h}.wav")))
                break

    def voice_line(job):
        i, side, text, v, emo, sp, path = job
        if not os.path.exists(path):
            minimax(text, v, emo, path, sp)
        print(f"  line {i:02d} {duration(path):5.2f}s  {v}: {text}", flush=True)
        return i, (side, path)

    with ThreadPoolExecutor(3) as pool:
        lines = dict(pool.map(voice_line, line_jobs))

    t = 0
    beats = []
    for i, b in enumerate(ep["beats"]):
        b = dict(b)
        hold = float(b.pop("hold", 0))
        if i in audio:
            sp = math.ceil(duration(audio[i]) * FPS)
            b["audio"] = web(audio[i])
            frames = sp + round((GAP + hold) * FPS)
        else:
            sp = round(max(hold, 1.0) * FPS)
            b["audio"] = None
            frames = sp
        if i in lines:
            side, path = lines[i]
            at = sp + round(0.15 * FPS) if i in audio else 0
            lf = math.ceil(duration(path) * FPS)
            b["line"] = {"audio": web(path), "side": side, "at": at, "frames": lf}
            frames = at + lf + round((GAP + hold) * FPS)
        b.update({"from": t, "frames": frames, "speechFrames": sp})
        beats.append(b)
        t += frames

    bgm = ep.get("bgm")
    tl = {
        "id": eid,
        "fps": FPS,
        "durationInFrames": t,
        "series": ep.get("series"),
        "candidate": {"name": ep.get("candidate", {}).get("name", "Kamu")},
        "interviewer": {"name": ep.get("interviewer", {}).get("name", "Yui"),
                        "image": ep.get("interviewer", {}).get("image", "brand/yui.png"),
                        "role": ep.get("interviewer", {}).get("role")},
        "bgm": bgm if bgm and os.path.exists(os.path.join(PUBLIC, bgm)) else None,
        "disclaimer": ep.get("disclaimer", "Dialog fiktif. Suara dan karakter dibuat dengan AI."),
        "beats": beats,
    }
    out = os.path.join(PUBLIC, "episodes", eid, "timeline.json")
    json.dump(tl, open(out, "w"), ensure_ascii=False, indent=1)
    print(f"wrote {os.path.relpath(out, ROOT)} — {t / FPS:.1f}s")
    if t / FPS > MAX_SECONDS:
        print(f"WARNING: {t / FPS:.1f}s is over the {MAX_SECONDS}s cap — cut or shorten beats")


if __name__ == "__main__":
    try:
        main()
    except RuntimeError as e:
        sys.exit(str(e))
