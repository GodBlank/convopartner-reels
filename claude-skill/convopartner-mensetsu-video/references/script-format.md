# Episode script format (`episodes/<id>.json`)

```json
{
  "id": "shiboudouki",
  "series": "Mensetsu #2 · 志望動機",
  "topic": "志望動機 — kenapa mau kerja di sini",
  "candidate": { "name": "Kamu", "voice": "male" },
  "interviewer": { "name": "Yui", "image": "brand/yui.png" },
  "beats": [ "...one object per spoken line..." ]
}
```
`id` is ascii (file + output name). `candidate.voice`: `male` | `female`. `bgm` optional (file in `public/`).

## Caption markup (in `say`, `title`, `cta.line`, `end.headline`)
- `*kata*` gradient (purple→magenta) marker — the key idea, 1 per line (max 2)
- `~kata~` red — mistakes, "Stop."
- `+kata+` green — the good outcome
Markers can span words: `*sebagai pekerja.*`. Markup is stripped before speaking.

## Common beat fields
| field | meaning |
|---|---|
| `scene` | `hook` · `host` · `chat` · `card` · `step` · `jp` · `app` · `cta` · `end` |
| `speaker` | `interviewer` (Yui) or `candidate` (KAMU) |
| `say` | spoken line + caption |
| `speak` | TTS-only pronunciation override (e.g. caption has `面接官` inside Indonesian → speak `mensetsukan`) |
| `caption` | display override |
| `sub` | small translation under the caption (hook / host / chat) |
| `hold` | extra seconds after the line (let a stamp land) |
| `emotion` | MiniMax only: happy · sad · angry · fearful · disgusted · surprised · calm (default: auto) |

## Scenes
**hook** (beat 1 only) — `title` (stake line, visible from frame 0), `say` = the JP question, `sub` = its meaning. Keep the JP question ≤ 12 characters per line.

**host** — Yui talks to camera, caption on top, voice bars + name tag.
`badge`: `{ "tag": "AWAS", "text": "⚠ Pertanyaan jebakan", "color": "red|green|gold|brand" }`. Green plays a ding — use for LOLOS.

**chat** — app-style chat. `quote`: Yui's question as the incoming bubble (optional). KAMU's line is typed into a gradient bubble.
`chips`: mistakes counted as they are said (cumulative). `stamp`: `"DITOLAK"` (red, buzz + impact) or `"LOLOS"` with `"stampColor": "green"` (chips turn green too). Add `"hold": 0.5` after a stamp.

**card** — elevated card; new rows appear spread across the spoken line, so several rows can land in ONE beat (preferred, saves time). Consecutive beats with the same `card.title` keep earlier rows still.
```json
"card": { "kicker": "Kenapa ini jebakan", "title": "Yang dicari 面接官", "icon": "?",
  "rows": [ { "kind": "no",  "label": "BUKAN", "text": "Data diri dari rirekisho" },
            { "kind": "yes", "label": "TAPI",  "text": "Kamu sebagai pekerja" } ],
  "note": "optional pill under the rows" }
```
`icon`: `"?" "!" "check" "x"` or a number. Row `kind`: `no` (✕ + strikethrough), `yes` (✓), `num` (needs `n`), `info`. Row text ≤ 28 characters.

**point** (listicles) — `"point": { "n": 1, "of": 5, "text": "Mikir lama sebelum jawab", "tag": "AKAR MASALAH" }` + `say` = VO. Shows progress bar, big number + overlay text, VO caption, Yui. Same `n` on consecutive beats continues the item. Overlay text ≤ ~40 characters.
When the item is a Japanese interview question, add `"romaji"` and `"arti"` to `point` (`text` = the JP question; it auto-sizes to one line).
Make the first beat of that item `say` = the JP question itself: it is shown big mid-screen with the arti under it; the following beats (same `n`) carry the Indonesian VO.

**hook teaser** — on the hook beat, `"teaser": 5` replaces the question box with 5 blurred numbered rows (curiosity gap); `say` is then the spoken headline.

**silent beats** — `"silent": true` skips TTS (e.g. the end card); use `hold` for its length.

**step** — gradient ring: `"step": { "n": 1, "of": 3, "word": "Salam" }` + a short `say` ("Satu, salam dan nama."). One-word `word`.

**jp** — Japanese answer card typed with the speech, then romaji + arti; voice bar below shows who speaks. No `say` — the jp text is spoken.
```json
"jp": { "kicker": "Langkah 1 · Salam", "text": "はじめまして。サリと申します。",
        "romaji": "Hajimemashite. Sari to moushimasu.", "arti": "Salam kenal. Nama saya Sari." }
```
≤ ~30 Japanese characters per jp beat.

**app** — the real app screen in a floating phone + Yui: `"app": { "screen": "feat5.png", "badge": "面接練習 · Mode Mensetsu" }` with a `say` bridging to ConvoPartner.
Prefer a real screen recording from `public/footage/` — ALWAYS `ls` the folder first (the user adds clips) and pick by file name:
"Jawaban wawancara kamu digrading.mp4" = grading/koreksi result (use whenever the line is about answers being graded/corrected),
"Simulasi wawancara kerja ke Jepang.mp4" = Yui interviewing in the app, "Shadowing bandingin suara kamu dengan native.mp4",
"Simulasi kehidupan sehari-hari di Jepang.mp4" = konbini roleplay, "200+ pertanyaan wawancara kerja ke Jepang.mp4" = question list (silent).
`"app": { "video": "footage/<file>.mp4", "volume": 0.15, "badge": "..." }` — plays in the phone with its own sound quiet under the voice; consecutive app beats on the same video continue it.

**Episode `speed`** (MiniMax) — top-level `"speed": 1.2` speeds up Indonesian lines (user preference: 1.2); Japanese lines stay at ≤ 1.05 so learners can follow.
**Pronunciation** — MiniMax reads slang like "Ceritain" and English/acronyms with an English lilt. Always add `speak` with Indonesian spelling:
"Ceritain"→"Ceritakan", JLPT→"je el pe te", N2/N3/N4→"en dua/en tiga/en empat", grammar→"tata bahasa" (change the on-screen word too).
Captions have a dark outline and the point scene a dark backdrop, so they stay readable over Yui.

**cta** — `"cta": { "word": "SHIBOU", "line": "kukirim *contoh jawaban lengkap* lewat DM." }` (spoken as "Komen SHIBOU. <line>").

**end** — last beat, `"hold": 0.8`, `"speak": "Dapatkan akses sekarang."`,
`"end": { "headline": "Latihan *mensetsu* bareng AI, 24 jam.", "sub": "...", "cta": "Dapatkan Akses Sekarang" }`. Shows logo, URL and the AI disclaimer.

## Safe zone
Instagram covers the top ~150 px and bottom ~320 px; scenes already respect it — don't add text there.
