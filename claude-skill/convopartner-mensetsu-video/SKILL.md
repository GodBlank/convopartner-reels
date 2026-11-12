---
name: convopartner-mensetsu-video
description: Produce a finished 50–60 s vertical reel (1080x1920 mp4) for Convopartner that walks through ONE Japanese job-interview (面接 / mensetsu) question, in Convopartner's own dark purple–magenta brand look with Yui (the app's AI partner) as a strict 面接官 — punchy hook, the viewer's wrong answer as an app-style chat with a DITOLAK stamp, info cards that build row by row, a 3-step formula with Japanese answer cards (romaji + arti), the real Mensetsu screen of the app, a "Komen KATA" CTA and an end card. Use whenever the user wants a mensetsu / interview-question video, says "bikin video mensetsu", "video pertanyaan interview Jepang", "lanjut seri mensetsu", "episode berikutnya", or names a question like 志望動機 / 長所と短所 / 逆質問 and wants it turned into a reel.
---

# Convopartner Mensetsu Video

Turns one mensetsu question into a **50–60 s** animated reel. Everything is drawn in code (Remotion) from
Convopartner's own brand assets, so every episode looks identical and costs only the voice.

Engine: `/Users/edward/Documents/edonihon-engine/mensetsu-video` (Remotion project, installed).
- `episodes/<id>.json` — the script you write. `episodes/jikoshoukai.json` is the reference episode: read it first.
- `tools/tts.py` — voices each beat, writes `public/episodes/<id>/timeline.json`; warns when over 60 s.
- `python tools/make.py <id> [eleven|minimax|gemini|say]` — voice + render to `out/<id>.mp4` (Mac/Windows; `tools/make.sh` is a Mac shortcut).
- `src/scenes.tsx` — the 9 scene types. `src/theme.ts` — brand colors/fonts. `public/brand/` — logo, Yui/Hana/Ken, app screens. `public/sfx/` — impact/whoosh/pop/ding/buzz (from `tools/sfx.py`).

Read `references/script-format.md` for the beat schema and caption markup before writing.

## Look (do not drift back to the reference account's style)
The format was learned from a viral "HRD galak" reel (@ivandarmawan16), but the visuals are deliberately
Convopartner's own: dark navy `#050816` with purple/magenta glows, gradient `#9B4DFF→#FF4AC8` (+ orange `#FF9B4A`),
green `#41D59A` for correct, Poppins + Plus Jakarta Sans, the anime partner **Yui** as the 面接官 (cut-out, glowing),
and the viewer answering as **"KAMU"** in an app-style chat with a press-to-talk voice bar. Never re-introduce
the light-grey office / flat-cartoon HRD look.

## Hook rules (first 2 s decide everything)
- Beat 1 is always `scene: "hook"`: frame 0 already shows the series pill + a stake line (`title`, ≤ 6 words, one *marker*), Yui zoom-punches in, flash + shake + impact SFX, then the JP question slams in.
- Stake lines that work: "Salah jawab ini, *langsung ditolak.*" · "Jawaban ini bikin *面接官 ilfeel.*" · "*99% pemula* jawab gini." (only if you can stand behind it — no invented stats; prefer non-numeric).
- Beat 2 shows the viewer's typical wrong answer failing (chat + chips + DITOLAK stamp) — by ~6 s.

## Arc (≈ 17 beats, 50–60 s — keep every line 1.5–4 s)
1 hook · 2 chat wrong answer + DITOLAK · 3 host "Stop." + why (badge AWAS) · 4 card BUKAN→TAPI (one beat, both rows) ·
5 host "Save dulu…" (badge SAVE gold) · 6–11 step 1/2/3 each followed by a jp answer line · 12 host smile + LOLOS badge ·
13 card "3 kesalahan fatal" (one beat, 3 JANGAN rows) · 14 chat objection "kalau blank gimana?" · 15 app (feat5.png, Mensetsu mode) ·
16 cta · 17 end.
If `tts.py` warns > 60 s: shorten lines first, then merge/cut beats (e.g. drop beat 12 or 14). Never go under ~48 s.

## Format B — listicle ("5 alasan…", "3 kesalahan…")
When the user hands a finished listicle script (title + numbered points with text overlay + VO), keep their
words and map them: hook with `"teaser": N` (blurred numbered rows) + `title` = their headline, `say` = it spoken ·
one `point` beat per item (`point.text` = their overlay, `say` = their VO; split VO longer than ~5 s into
consecutive beats with the same `point.n`; `"tag": "AKAR MASALAH"` marks the key one) · when a VO mentions
ConvoPartner, put that sentence in `app` beats (same `screen` → continues without re-entering; `cara4.png` = grading/koreksi) ·
`cta` (`speak` can reorder to their exact CTA wording, `"hold": 1`) as the LAST beat — the user does not want the ConvoPartner end card on listicles (2026-11-10).
Don't pad a short script to reach 50 s — 35–60 s is fine for listicles. If the user's VO runs past 60 s, render it as written
AND a tightened `<id>-60` cut (one JP-question beat + one VO beat per item, same meaning, ConvoPartner line kept) and let them pick.
References: `episodes/5-alasan-gagal.json` (text items), `episodes/5-pertanyaan.json` + `5-pertanyaan-60.json` (JP-question items with romaji/arti).

## Format C — what-if story ("Bagaimana jika…" / "Apa jadinya kalau…")
Two pillars, defined by the user (2026-11-10):
- **Bagaimana jika** = something that can't really happen / absurd, but makes people curious (e.g. "Bagaimana jika orang Jepang nggak bisa tatemae lagi?").
- **Apa jadinya kalau** = realistic situation, simple enough for a layperson to grasp instantly (e.g. "Apa jadinya kalau kamu telat 5 menit kerja di Jepang?").
Debate-bait pillar. Arc (≈ 55 s, `"speed": 1.2`, `interviewer.role: "AI Partner"`, `series: "Bagaimana Jika"`):
hook with `swap` (thing crossed out → replacement icon) · `card` with a checkable fact · `host` + `chat` (stamp BLANK) showing the pain ·
`duel` story of two illustrative people (label "Cerita ilustrasi"; `focus`, `bubbles`, `ask` "siapa yang diterima?", `stamp`, `later` + `climb`) —
ConvoPartner enters inside the story (one person practises in it; `video` on that side) · last beat `debate` (two camps + "Tulis pendapatmu di komen").
User wants simple-but-sharp lines, curiosity held to the end, work-in-Japan angle, positive payoff (speaking gets you in, then salary/career grow),
CTA as an open question ("Menurutmu, lebih penting A atau B? Coba kasih pendapatmu di komen"). No end card. Reference: `episodes/jlpt-dihapus.json`.
Story art: give each duel side an `image` (cut-out PNG) and the duel a `bg` → characters stand over the background (later beat: other `bg`,
`solo`, outfit swap, empty `tag`). Art lives in `public/story/chars` + `public/story/bg` (rina, dimas, dimas-kerja; wawancara, kerja).
New art: no paid image API → give the user AI Studio web prompts using `public/brand/yui.png` as style reference, characters on solid #00FF00;
then key with ffmpeg `scale=-1:1600,colorkey=0x00FF00:0.32:0.12,despill=type=green:mix=0.6:expand=0.2,format=rgba` → .png,
and crop any grey band off the bottom of generated backgrounds (they came with ~230 px), `scale=1080:-2` → .jpg.

## Workflow
1. **Pick the question.** If the user didn't name one, propose 3 from the series list and let them pick. Check `episodes/` to avoid repeats; bump the series number (`"series": "Mensetsu #2 · 志望動機"`).
2. **Write `episodes/<id>.json`.** Indonesian casual for Yui's explanations (aku/kamu, "nggak", "udah"); Japanese for the question and model answers — natural, polite (です/ます, 申します, いたします), correct; double-check every jp line + romaji + arti. Default jobs: Tokutei Ginou fields (介護, 外食, 製造, 農業, 建設) — vary across episodes.
   Brand rules: paid product — never "gratis/free trial"; no promise of passing or of jobs in Japan; CTA "Dapatkan Akses Sekarang"; mention ConvoPartner only in the app beat + end card. CTA code word: one uppercase word tied to the topic (tell the user to set the DM auto-reply for it).
3. **Show the script** as a compact table (beat · scene · line) and wait for OK. Edits are cheap now.
4. **Voice + render** (background): `python tools/make.py <id> eleven` (Sarah v3; default provider `minimax`).
   - `minimax` (default, user's subscription) = MiniMax `speech-2.8-hd`. Key: `MINIMAX_API_KEY` in env or `mensetsu-video/.env` (never print it). Voices: Yui = `Indonesian_ConfidentWoman`, KAMU = `Indonesian_DeterminedBoy` / `Indonesian_CharmingGirl` (female) — same voice speaks the Japanese lines (`language_boost` auto-switches per line, so KAMU sounds like a real Indonesian speaking Japanese). Optional per-beat `"emotion"`: happy, sad, angry, fearful, disgusted, surprised, calm — leave unset unless a line sounds flat. Swap voices in `MINIMAX` in tts.py (other options: `Indonesian_BossyLeader`, `Indonesian_CalmWoman`, `Japanese_DecisivePrincess`, `Japanese_ColdQueen`). On "invalid api key" with a China account, set `MINIMAX_URL=https://api.minimaxi.com/v1/t2a_v2`.
   - `gemini` = Gemini TTS via treg: Yui = "Kore", KAMU = "Puck" (or "Leda" with `"candidate": {"voice": "female"}`). ~$0.035/line ≈ $0.6/episode. Check `~/.local/bin/treg balance` first; if too low tell the user to top up (`treg topup`) or use `say`.
   - `eleven` = ElevenLabs (`ELEVENLABS_API_KEY` in .env). Default Yui = **Sarah on eleven_v3** (user picked it 2026-11-10 as more
     natural than MiniMax). Free tier: 10k chars/month, 2 concurrent requests, premade voices only (library Indonesian voices
     such as Honeypie/Anjani/Putri Maharani need a paid plan; Cahaya/Aita need Creator) and non-commercial — remind the user
     a paid plan is needed before posting ads. ~700 chars per episode. Flow-splits at character timestamps. Speed is native (no 1.2x).
   - `say` = free macOS voices, robotic — drafts/timing only, never for posting.
   - Audio is cached per line; editing one line re-voices only that line (with flow: only that paragraph).
   - **Flow (MiniMax default):** consecutive Indonesian lines of the same voice are voiced as one paragraph (≤ 5 lines,
     ≤ 320 chars) with `<#0.4#>` pauses and cut back per beat at MiniMax's subtitle timestamps — much less stiff than
     line-by-line. Japanese lines stay single. `"flow": false` in the episode turns it off.
5. **QA:** sample frames (`ffmpeg -i out/<id>.mp4 -vf "select=...,tile"` or `npx remotion still Mensetsu out/s.png --frame=N --props='{"episode":"<id>"}'`). Check frame 0 is crisp and readable, nothing overflows, JP lines wrap sensibly, and nothing important sits in the Reels safe zone (top 150 px, bottom 320 px).
6. **Deliver** `out/<id>.mp4` + IG caption: hook line in quotes, why it's a trap, the 3-step formula as a list, "Save", "Komen KATA", disclaimer "Dialog fiktif. Suara dibuat dengan AI.", 5 hashtags (#mensetsu #kerjadijepang #tokuteiginou #bahasajepang #convopartner) — plus the code word to set up.

## Series list
自己紹介 (#1 done) · 志望動機 · なぜ日本で働きたいですか · 長所と短所 · 日本語はどのくらい話せますか · 前の仕事をやめた理由 · 日本で困ったらどうしますか · 将来の夢 / 何年働きたいですか · 残業できますか · 逆質問 (何か質問はありますか) · 体力に自信がありますか · 寮生活は大丈夫ですか

## Changing things
- Host: `"interviewer": {"name": "Yui", "image": "brand/yui.png"}` (also `brand/hana.png`, `brand/ken.png`; Ken needs a male voice — change `GEMINI["interviewer"]` in tts.py).
- App screen in the app beat: any file in `public/brand/` (`feat5.png` = Mensetsu mode, `cara4.png` = koreksi).
- Background music: `public/bgm.mp3` + `"bgm": "bgm.mp3"` (mixed at 8 %).
- Preview: `npx remotion studio` → composition "Mensetsu".
