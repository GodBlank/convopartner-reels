// Caption markup used in episode scripts:
//   *kata*  -> yellow marker highlight
//   ~kata~  -> red text
//   +kata+  -> green text
// Tokens are revealed word-by-word, timed proportionally to character length.

export type Tone = "plain" | "mark" | "red" | "green";
// glue: no space before this token (e.g. "*latihan*?" -> "latihan" + glued "?")
export type Token = { text: string; tone: Tone; at: number; glue: boolean };

const CJK = /[぀-ヿ㐀-鿿＀-￯]/;

export const isJapanese = (s: string) => CJK.test(s);

export const stripMarkup = (s: string) => s.replace(/[*~+]/g, "");

const splitCjk = (word: string): string[] => {
  if (!CJK.test(word) || word.length <= 3) return [word];
  const out: string[] = [];
  let i = 0;
  while (i < word.length) {
    let chunk = word.slice(i, i + 2);
    i += 2;
    // keep trailing punctuation attached to the previous chunk
    while (i < word.length && /[、。！？!?,.」』）)]/.test(word[i])) {
      chunk += word[i];
      i++;
    }
    out.push(chunk);
  }
  return out;
};

// Returns tokens with `at` in [0,1): the fraction of the speech at which each token appears.
export const tokenize = (src: string): Token[] => {
  const raw: { text: string; tone: Tone; glue: boolean }[] = [];
  let tone: Tone = "plain";
  let buf = "";
  let sep = true;
  const flush = () => {
    if (!buf) return;
    splitCjk(buf).forEach((piece, i) => {
      // CJK chunks of one word render without spaces between them
      raw.push({ text: piece, tone, glue: i > 0 || !sep });
    });
    buf = "";
    sep = false;
  };
  for (const ch of src) {
    const t: Tone | null =
      ch === "*" ? "mark" : ch === "~" ? "red" : ch === "+" ? "green" : null;
    if (t) {
      flush();
      tone = tone === t ? "plain" : t;
    } else if (ch === " " || ch === "\n") {
      flush();
      sep = true;
    } else {
      buf += ch;
    }
  }
  flush();
  if (raw.length) raw[0].glue = false;
  const total = raw.reduce((a, r) => a + r.text.length + 1, 0) || 1;
  let acc = 0;
  return raw.map((r) => {
    const tok = { ...r, at: acc / total };
    acc += r.text.length + 1;
    return tok;
  });
};
