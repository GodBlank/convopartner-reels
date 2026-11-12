export type Speaker = "interviewer" | "candidate";

export type CardRow = {
  kind: "no" | "yes" | "num" | "info";
  label?: string; // small pill above the row text (BUKAN, TAPI, JANGAN, COBA ...)
  text: string;
  n?: number; // for kind "num"
};

export type LedgerRow = { label: string; yen: number; kind?: "base" | "minus" | "total" | "save" | "send"; rp?: string; icon?: string };

export type Bubble = string | { text: string; sub?: string; tone?: "red"; voice?: string; emotion?: string; speed?: number }; // sub = translation under the line; voice = also spoken by that character (tools/tts.py LINE_VOICES)

export type DuelSide = { name: string; tag: string; trait: string; video?: string; image?: string }; // image: cut-out character (public/), replaces the card

export type Beat = {
  scene: "hook" | "host" | "chat" | "card" | "step" | "point" | "jp" | "app" | "cta" | "end" | "duel" | "debate" | "ledger";
  speaker?: Speaker | null;
  say?: string; // caption + speech, with markup (*mark* ~red~ +green+)
  caption?: string; // display override
  sub?: string; // small translation line under the caption
  mood?: "stern" | "smile";
  title?: string; // hook: the stake line shown from frame 0
  money?: boolean; // hook: yen notes and coins raining down
  teaser?: number; // hook: show N blurred numbered rows instead of the question box (listicles)
  // hook: "from" is crossed out and replaced by icon + "to". kind "sheet" = JLPT-style answer sheet, "mask" = smiling mask that cracks
  swap?: { from: string; to: string; icon?: string; kind?: "sheet" | "mask" | "coin" | "news" | "screen" | "thought" };
  // hook: two characters on a diagonal split screen (each over their own place), swap icon between them; Yui is voice only
  duo?: { left: { image: string; name: string; place: string; bg: string }; right: { image: string; name: string; place: string; bg: string }; icon?: string };
  point?: { n: number; of: number; text: string; tag?: string; romaji?: string; arti?: string }; // listicle item (text = on-screen overlay; romaji/arti under a JP question)
  badge?: { tag: string; text: string; color?: "red" | "green" | "gold" | "brand" };
  quote?: string; // chat: the interviewer's question shown as the incoming bubble
  chips?: string[]; // chat: numbered pills (cumulative)
  stamp?: string; // chat: big stamp (DITOLAK / LOLOS)
  stampColor?: "red" | "green";
  card?: {
    kicker?: string;
    title: string;
    icon?: "?" | "!" | "check" | "x" | number;
    rows: CardRow[]; // cumulative: repeat earlier rows, append new ones
    note?: string;
  };
  step?: { n: number; of: number; word: string; kicker?: string };
  jp?: { kicker?: string; text: string; romaji?: string; arti?: string };
  // screenshot in public/brand, or a screen recording (path under public/, e.g. "footage/x.mp4") played in the phone;
  // volume = its own sound under the voice (default 0.15); videoFrom is filled in by Root (continues across beats)
  app?: { screen?: string; video?: string; volume?: number; videoFrom?: number; badge?: string; demo?: boolean; rate?: number }; // demo: big upright phone, no Yui, so the footage reads
  // money table built row by row (cumulative like card; `fresh` = how many trailing rows animate when the previous beat is not this table)
  ledger?: { title: string; kicker?: string; note?: string; fresh?: number; rows: LedgerRow[] };
  cta?: { word: string; line?: string };
  // story beat: two people side by side (same names on consecutive beats continue the scene)
  duel?: {
    left: DuelSide;
    right: DuelSide;
    focus?: "left" | "right" | "both";
    bubbles?: { left?: Bubble; right?: Bubble };
    ask?: boolean; // big "?" between the two (who wins?)
    stamp?: { side: "left" | "right"; text: string; color?: "red" | "green" };
    later?: string; // time-jump banner, e.g. "3 bulan kemudian…"
    climb?: { side: "left" | "right"; steps: string[]; note?: string }; // level steps rising next to that card (N4 → N3 → N2)
    label?: string; // small pill on top, e.g. "Cerita ilustrasi"
    bg?: string; // background image (public/) behind the characters; crossfades when it changes
    solo?: "left" | "right"; // only this person on screen (the other has left the story)
    screen?: { side: "left" | "right"; text: string; fix?: string; tone?: "red" | "green" }; // glowing error screen above that person's head
    thought?: { side: "left" | "right"; text: string }; // thought cloud above that person's head (what they really think)
    fine?: { to: number; from?: number; label?: string; tone?: "red" | "green" }; // yen counter ticking up from the previous beat's total
    // motion (story feel): camera eases from the previous beat's framing to this one (none = back to neutral)
    cam?: "push" | "close" | "pull" | "left" | "right";
    shake?: boolean; // short camera shake + white flash at the start (shock / twist)
    react?: { side: "left" | "right"; kind: "jump" | "shrink" | "nod" | "shiver" }; // body reaction of that person
    mood?: "night" | "dusk" | "warm" | "dark"; // colour grade over the scene
    fx?: "rain" | "dust" | "steam" | "sparkle"; // particles in front of the background
    cut?: boolean; // with `later`: full-screen black time-jump card before the scene
  };
  // comment-debate CTA: two camps on a split screen
  debate?: { left: { icon: string; label: string }; right: { icon: string; label: string }; prompt?: string };
  end?: { headline: string; sub?: string; cta?: string };
  ambience?: "room" | "crowd" | "rain" | "train" | "tick" | "city"; // looped background sound (consecutive beats share one loop)
  // filled in by tools/tts.py
  audio?: string | null;
  line?: { audio: string; side: "left" | "right"; at: number; frames: number }; // character's spoken bubble, `at` frames into the beat
  from: number;
  frames: number;
  speechFrames: number;
};

export type Timeline = {
  id: string;
  fps: number;
  durationInFrames: number;
  series?: string;
  candidate: { name: string };
  interviewer: { name: string; image: string; role?: string | null }; // image: path in public/; role: name-tag pill (default 面接官)
  bgm?: string | null;
  disclaimer?: string;
  beats: Beat[];
};
