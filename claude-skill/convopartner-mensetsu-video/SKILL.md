---
name: convopartner-mensetsu-video
description: Produce finished 50–60 s vertical reels (1080x1920 mp4) for Convopartner in its dark purple–magenta brand look with Yui (the app's AI partner) as host/narrator. Three formats - (A) one Japanese job-interview (面接 / mensetsu) question with a wrong answer, steps and JP model answers; (B) listicles; (C) story reels "Bagaimana jika…" / "Apa jadinya kalau…" with Rina and Dimas as anime characters, spoken character lines, camera motion, money tables, and a 2-camp comment debate at the end. Use whenever the user wants a Convopartner reel, says "bikin video mensetsu", "lanjut seri", "generate script/angle Bagaimana jika", "TOFU / MOFU", "render T7", names an angle or a mensetsu question, or hands a script to turn into a video.
---

# Convopartner reels

Everything is drawn in code (Remotion) from Convopartner's own assets, so every episode looks consistent and costs
only voice credits. Engine = the `mensetsu-video` repo (github.com/GodBlank/convopartner-reels). On the user's Mac it
was at `~/Documents/edonihon-engine/mensetsu-video`; on other machines find it by its `README.md` / `tools/make.py`.
Conversation with the user is in **Indonesian** (casual, "kamu").

## Engine map
- `episodes/<id>.json` — the script you write (one object per beat). Read `references/script-format.md` first.
- `python tools/make.py <id> eleven` — voice + render to `out/<id>.mp4` (Mac/Windows). Run it in the background.
- `python tools/tts.py episodes/<id>.json --provider eleven` — voice only; prints per-beat seconds and warns over 60 s.
- `npx remotion still Mensetsu out/stills/x.png --frame=N --props='{"episode":"<id>"}'` — one frame (PowerShell: same quoting works in `cmd`, or escape the inner quotes).
- `python tools/stt.py <wav>` — transcribe a voice file to check every word was spoken.
- `python tools/rig.py` — cut moving-hand layers + measure eyes for character puppets. `python tools/sfx.py` — sound effects + ambience loops.
- `src/scenes.tsx` (all scenes), `src/puppet.tsx` (blinking eyes, moving hand), `src/Root.tsx` (timeline, ambience), `src/types.ts` (every field).
- Scripts and angle lists the user approved live in `scripts/*.md` — check them before writing new ones (avoid repeats, keep numbering T1…, M1…).
- Secrets: `.env` holds `ELEVENLABS_API_KEY`, `_2`, `_3`… (auto-rotated when one runs out), `MINIMAX_API_KEY`, `GEMINI_API_KEY`.
  Never print or echo key values; check only length/prefix. Tell the user to paste keys into `.env`, never into chat.

## Look
Dark navy `#050816`, purple/magenta glows, gradient `#9B4DFF→#FF4AC8` (+ orange `#FF9B4A`), green `#41D59A`, Poppins.
Yui = host. Story characters = anime cut-outs over anime backgrounds (keep this art style — the user rejected a flat-vector redesign 2026-11-12).
Never copy the visual style of the reference accounts the formats were learned from.

## Voices (current setup)
- **Narration (Yui) = ElevenLabs Sarah, eleven_v3** (`--provider eleven`). Episode `"tempo": 1.15` (1.1 if there is room). Tempo is applied
  after synthesis, so changing it costs no credits. The user prefers 1.15 for number-heavy videos (1.2 sounds rushed).
- **Character lines = MiniMax** (user's subscription): a bubble with `"voice"` is spoken by that character right after the narration
  (aliases in `LINE_VOICES` in tts.py: `dimas`, `rina` = Indonesian voices speaking Japanese (natural accent); `pria`, `atasan`, `koki`,
  `pemuda`, `wanita`, `nenek`, `tanaka` = native Japanese voices; `ibu` = Indonesian woman). Optional `"emotion"`, `"speed"`.
- **Sarah v3 drops words written as number words** ("dua puluh enam juta" came out "dua puluh enam"). Write numbers as digits in `say`
  ("Gaji 26 juta rupiah") and run `tools/stt.py` on hook/number lines before the full render.
- Free ElevenLabs = non-commercial, 10k chars/month per account. Remind the user a paid plan is needed before ads; multiple free
  accounts may break ElevenLabs ToS. When all keys are out, stop and tell the user (don't silently switch the narration voice).
- Audio is cached per line (and per flow paragraph): re-rendering an unchanged episode costs nothing.

## Formats
**A · Mensetsu question** and **B · Listicle** — see `references/script-format.md` (hook/chat/card/step/jp/app/cta/end, point, teaser).
Brand rules there: paid product (never "gratis"), no promise of passing/jobs, CTA "Dapatkan Akses Sekarang", no end card on listicles.

**C · Story reels** (the user's main series now). Two pillars:
- **Bagaimana jika** = absurd/impossible but creates curiosity. **Apa jadinya kalau** = realistic, easy for laypeople.
- **TOFU** (top of funnel) = broad Japan/anime/work-abroad audience: **no ConvoPartner, no app demo, no product mention** — pure story.
  **MOFU** = learners preparing for mensetsu/work: story + 2 demo app beats naming the feature (`app.demo: true`, footage from `public/footage-web/`).
- Story rules (user, 2026-11-11): the hook promises a reveal ("…dan yang dia lakukan di jam terakhir bikin satu keluarga nangis");
  every beat raises the stakes and ends on a mini-cliffhanger; the twist lands at ~75% and reframes the story; the debate question
  comes from the twist, two camps that are both reasonable. Simple, sharp lines; curiosity to the very end.
- Logic must hold up: the user catches plot holes (e.g. "if everyone swapped countries, who runs the warung?", "the interviewer asks
  for jikoshoukai first"). Re-read the premise for contradictions before showing a script.
- Facts and numbers must be checkable: search when unsure (exchange rate, laws, statistics), round honestly, label simulations on screen
  (`duel.label` "Simulasi · termasuk lembur 20 jam/bulan"), and list "Cek fakta" notes under the script. JP lines: natural, correct,
  romaji + arti; flag lines a sensei should check. For a phrase that is grammatical but unnatural, propose the natural alternative.
- Cast: Yui (narrator, appears in hook + debate) · Rina (hijab, `rina`, `rina-senang`, `rina-sedih`) · Dimas (`dimas` suit, `dimas-kerja`,
  `dimas-travel`) · `interviewer`, `interviewer-honne`, `atasan`, `tanaka`, `ibu-rina`, `petugas`. Backgrounds in `public/story/bg/`.
  Always `ls public/story/chars public/story/bg` first — the user keeps adding art.

### Story workflow
1. Angles: table with hook · what keeps people watching · twist · 2 camps · assets (✅ exists / 🆕 needs art). Save to `scripts/`.
2. Script: numbered beats (hook → setup → escalation → cliffhanger → twist → debate), 🔊 for spoken character lines, visual notes,
   "Cek fakta" notes. Save to `scripts/` and show the user a compact summary; wait for OK before rendering.
3. Missing art → give Gemini (AI Studio) prompts. Several images per prompt is fine ("generate 4 SEPARATE images, not a collage").
   Reference images: a character → `public/story/chars/dimas-travel.jpeg` or `Ibu-Rina.jpeg`; a background → `public/story/bg/Tokyo.jpeg`.
   Characters on solid #00FF00; key with ffmpeg
   `scale=-1:1600,colorkey=0x00FF00:0.32:0.12,despill=type=green:mix=0.6:expand=0.2,format=rgba` → lowercase `.png`;
   backgrounds `scale=1080:-2` → lowercase `.jpg`. For a new character to get blinking eyes + a moving hand, measure eyes and a hand
   polygon on a gridded crop, add it to `CUTS`/`EYES` in `tools/rig.py` and `RIGS` in `src/puppet.tsx`, run `python tools/rig.py`.
4. Write `episodes/<id>.json`, voice with `tts.py`, read the per-beat seconds. Over 60 s → shorten narration first (lines the
   characters already say need no narration), merge beats, then tempo 1.15, then trim `hold`s. Never cut the twist or the debate.
5. **Check frames before every full render**: stills at ~85–95% of each beat's speech (`from + speechFrames*0.9`; for beats with a
   spoken line use `from + line.at + line.frames/2`), hstack them into contact sheets, and look for: caption lines (≤ 3) hitting
   screens/thought clouds, screens covering name pills (drop `cam` on that beat), text running off the edge (shorten), table rows
   overlapping the caption. Fix, then render.
6. Render in the background, report duration, send the mp4, list what to check (JP lines, facts, poses).

### Story building blocks (fields in `references/script-format.md`)
- `duel` scene: two characters over `bg`, `focus`, `solo`, `later` (time banner) + `cut` (black time-jump card), `bubbles` (with `voice`),
  `thought`, `screen` (glowing panel, `tone` red/green), `stamp`, `fine` (yen counter, `label`, `tone`), `react` (jump/shrink/nod/shiver),
  `cam` (push/close/pull/left/right — eases from the previous beat), `shake` (flash + impact), `mood` (night/dusk/warm/dark),
  `fx` (dust/sparkle/rain/steam). Beat-level `ambience` (room/crowd/train/tick/city/rain) plays as one loop across consecutive beats;
  leave it off a beat for a sudden silence.
- `hook` extras: `swap.kind` coin/news/screen/thought; `duo` (two characters on a diagonal split screen, each over their own place,
  swap icon — use for two-world stories); `money: true` (yen notes and coins raining).
- `ledger` scene: a money table built row by row (base → minus rows → total → save/send), consecutive beats with the same title keep
  earlier rows; `fresh` = trailing rows to animate when returning to the table later.
- `debate` (always last): two camps + "Tulis pendapatmu di komen". CTA wording the user likes: "Tim X, atau tim Y? Tulis di komen."

## Delivery checklist
- Duration ≤ 60 s. Exact numbers on screen match the narration. Every JP line has romaji + arti.
- Tell the user which ElevenLabs key is in use when one ran out, and anything that still needs a sensei / fact check.
- After engine or script changes the user wants to keep, commit (the user pushes; pushing from here may be blocked).
