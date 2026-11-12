# Convopartner reels engine (Remotion)

Makes the 50–60 s vertical reels for Convopartner: Yui as narrator, Rina/Dimas story scenes, character voices,
money tables, and a 2-camp comment debate at the end. Each episode is a JSON script in `episodes/`, and
`out/<id>.mp4` is the finished video.

## Setup on a new computer

### Windows
1. Install **Node.js 22 LTS** from nodejs.org, and **Python 3.10+** from python.org. Tick *"Add python.exe to PATH"* during setup.
2. Install **Git** from git-scm.com, then clone this repo (or copy the folder).
3. In a terminal inside `mensetsu-video`:
   ```
   npm install
   pip install numpy pillow
   ```
   `npm install` also brings ffmpeg (`ffmpeg-static`), so ffmpeg does not need to be installed separately.
4. Create `.env` in this folder (it is **not** in git) with your keys:
   ```
   ELEVENLABS_API_KEY=...
   ELEVENLABS_API_KEY_2=...
   ELEVENLABS_API_KEY_3=...
   MINIMAX_API_KEY=...
   GEMINI_API_KEY=...
   ```
5. Optional: copy `claude-skill/convopartner-mensetsu-video` to `%USERPROFILE%\.claude\skills\` so Claude Code knows the workflow.

### Mac
```
brew install node python
npm install
pip3 install numpy pillow
cp -R claude-skill/convopartner-mensetsu-video ~/.claude/skills/
```
Then create `.env` as above.

## Make a video
```
python tools/make.py <episode-id> eleven
```
This voices the script (narration: ElevenLabs Sarah v3; character lines: MiniMax) and renders `out/<episode-id>.mp4`.
On Mac, `tools/make.sh <episode-id> eleven` does the same.

Other useful commands:
- `npm run dev`: Remotion Studio, to preview episodes in the browser.
- `npx remotion still Mensetsu out/s.png --frame=120 --props={"episode":"<id>"}`: render one frame to check the layout. In PowerShell, wrap the props in single quotes.
- `python tools/rig.py`: re-cut the moving-hand layers after changing a character image.
- `python tools/sfx.py`: regenerate the sound effects and ambience loops.

## Folder map
| Folder | What is in it |
|---|---|
| `episodes/` | One JSON script per video |
| `scripts/` | Angle lists and written scripts (Markdown) |
| `public/story/` | Characters (`chars/`), backgrounds (`bg/`), hand-rig layers (`rig/`) |
| `public/footage/` | ConvoPartner app recordings |
| `public/episodes/<id>/` | Generated voice files and `timeline.json`. Kept in git so re-renders cost no TTS credits |
| `src/` | The Remotion scenes |
| `tools/` | `tts.py` (voices), `make.py` (voice + render), `rig.py`, `sfx.py`, `img.py` |
| `claude-skill/` | Copy of the Claude Code skill for this workflow |

## Notes
- The `say` voice provider only works on Mac. Use `eleven` or `minimax` on Windows.
- ElevenLabs keys rotate automatically: when one runs out of credits, the next `ELEVENLABS_API_KEY_n` is used.
- Character images come from Gemini on a #00FF00 background. Key them with the ffmpeg command in the skill's SKILL.md.
