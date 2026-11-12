import React from "react";
import {
  AbsoluteFill,
  Easing,
  Audio,
  Img,
  interpolate,
  OffthreadVideo,
  random,
  Sequence,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { useAudioData, visualizeAudio } from "@remotion/media-utils";
import { isJapanese, stripMarkup, tokenize } from "./markup";
import { Puppet, RIGS } from "./puppet";
import { BODY, C, GRAD, GRAD_TRI, HEAD } from "./theme";
import type { Beat, CardRow, DuelSide, LedgerRow, Timeline } from "./types";

export type SceneProps = {
  beat: Beat;
  prev: Beat | null; // previous beat, used to keep continuing scenes still
  tl: Timeline;
};

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

// ------------------------------------------------------------------ helpers

const usePop = (delay = 0, from = 0.9) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: frame - delay, fps, config: { damping: 14, stiffness: 180 } });
  return { transform: `scale(${interpolate(s, [0, 1], [from, 1])})`, opacity: interpolate(s, [0, 0.4], [0, 1], clamp) };
};

const sameScene = (a: Beat | null, b: Beat) => {
  if (!a || a.scene !== b.scene) return false;
  if (b.scene === "card") return a.card?.title === b.card?.title;
  if (b.scene === "step" || b.scene === "hook") return false;
  if (b.scene === "chat") return a.quote === b.quote;
  return true;
};

const Sfx: React.FC<{ name: "impact" | "whoosh" | "pop" | "ding" | "buzz"; at?: number; volume?: number }> = ({
  name,
  at = 0,
  volume = 0.5,
}) => (
  <Sequence from={Math.max(0, Math.round(at))} layout="none">
    <Audio src={staticFile(`sfx/${name}.wav`)} volume={volume} />
  </Sequence>
);

// Dark brand background: two soft glows + a faint purple grid.
const Bg: React.FC<{ glow?: number }> = ({ glow = 1 }) => {
  const frame = useCurrentFrame();
  const drift = Math.sin(frame / 40) * 40;
  return (
    <AbsoluteFill style={{ background: C.bg }}>
      <AbsoluteFill
        style={{
          background: `radial-gradient(circle at ${20 + drift / 20}% 18%, rgba(155,77,255,${0.35 * glow}) 0%, transparent 45%),
            radial-gradient(circle at 85% ${80 - drift / 20}%, rgba(255,74,200,${0.22 * glow}) 0%, transparent 45%)`,
        }}
      />
      <AbsoluteFill
        style={{
          backgroundImage:
            "linear-gradient(rgba(155,77,255,0.07) 2px, transparent 2px), linear-gradient(90deg, rgba(155,77,255,0.07) 2px, transparent 2px)",
          backgroundSize: "72px 72px",
          maskImage: "radial-gradient(circle at 50% 40%, black 30%, transparent 80%)",
        }}
      />
    </AbsoluteFill>
  );
};

const Enter: React.FC<{ on: boolean; children: React.ReactNode }> = ({ on, children }) => {
  const pop = usePop(0, 0.94);
  return <AbsoluteFill style={on ? pop : undefined}>{children}</AbsoluteFill>;
};

const GradText: React.FC<{ children: React.ReactNode; grad?: string }> = ({ children, grad = GRAD }) => (
  <span style={{ background: grad, WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}>{children}</span>
);

// Word-by-word caption. Words not yet spoken keep their space (stable layout); the next one
// is previewed faintly, blurred.
export const Caption: React.FC<{
  text: string;
  speechFrames: number;
  size: number;
  align?: "center" | "left" | "right";
  color?: string;
  instant?: boolean;
  font?: string;
}> = ({ text, speechFrames, size, align = "center", color = C.text, instant = false, font = HEAD }) => {
  const frame = useCurrentFrame();
  const toks = tokenize(text);
  const span = Math.max(1, speechFrames - 6);
  const next = toks.findIndex((t) => t.at * span > frame);
  const fs = isJapanese(text) ? size * 0.86 : size;
  return (
    <div
      style={{
        fontFamily: font,
        fontSize: fs,
        fontWeight: 800,
        lineHeight: 1.2,
        letterSpacing: -0.5,
        color,
        textAlign: align,
        wordBreak: "keep-all",
        textShadow: "0 0 3px #050816, 0 2px 6px #050816, 0 0 18px rgba(5,8,22,0.95), 0 8px 30px rgba(5,8,22,0.85)",
      }}
    >
      {toks.map((t, i) => {
        const appear = instant ? -10 : t.at * span;
        const k = interpolate(frame, [appear, appear + 5], [0, 1], clamp);
        const preview = i === next ? 0.22 : 0;
        const op = Math.max(k, preview);
        const blur = k > 0 ? (1 - k) * 8 : 7;
        const markPrev = i > 0 && toks[i - 1].tone === "mark" && t.tone === "mark";
        const markNext = i + 1 < toks.length && toks[i + 1].tone === "mark" && t.tone === "mark";
        // inside a marker run the space lives in the highlighted span, so the run reads as one bar
        const spaceInside = markPrev && !t.glue;
        const tone =
          t.tone === "red"
            ? { color: C.red }
            : t.tone === "green"
              ? { color: C.green }
              : t.tone === "mark"
                ? {
                    background: GRAD,
                    color: "#fff",
                    borderRadius: `${markPrev ? 0 : 10}px ${markNext ? 0 : 10}px ${markNext ? 0 : 10}px ${markPrev ? 0 : 10}px`,
                    padding: `0 ${markNext ? 0 : 10}px 0 ${markPrev ? 0 : 10}px`,
                    whiteSpace: "pre" as const,
                  }
                : {};
        return (
          <React.Fragment key={i}>
            {i > 0 && !t.glue && !spaceInside ? " " : null}
            <span
              style={{
                display: "inline-block",
                opacity: op,
                filter: `blur(${blur}px)`,
                transform: `translateY(${(1 - k) * 10}px)`,
                ...tone,
              }}
            >
              {spaceInside ? ` ${t.text}` : t.text}
            </span>
          </React.Fragment>
        );
      })}
    </div>
  );
};

const captionOf = (b: Beat) => b.caption ?? b.say ?? "";

const Sub: React.FC<{ text: string; delay?: number; align?: "center" | "left" | "right" }> = ({ text, delay = 0, align = "center" }) => {
  const frame = useCurrentFrame();
  const k = interpolate(frame, [delay, delay + 8], [0, 1], clamp);
  return (
    <div style={{ marginTop: 20, fontFamily: BODY, fontSize: 42, fontWeight: 600, color: C.muted, textAlign: align, opacity: k, lineHeight: 1.3 }}>
      {text}
    </div>
  );
};

// Live voice bars from the beat's audio (the app's "press to talk" feel).
const Wave: React.FC<{ src?: string | null; bars?: number; height?: number; color?: string }> = ({
  src,
  bars = 28,
  height = 70,
  color = "#fff",
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const data = useAudioData(src ? staticFile(src) : staticFile("sfx/pop.wav"));
  const vals =
    src && data
      ? visualizeAudio({ fps, frame, audioData: data, numberOfSamples: 32 }).slice(0, bars)
      : Array.from({ length: bars }).map(() => 0);
  const half = vals.slice(0, bars / 2);
  const mirrored = [...half.slice().reverse(), ...half];
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 7, height }}>
      {mirrored.map((v, i) => (
        <div
          key={i}
          style={{ width: 9, borderRadius: 5, background: color, height: Math.max(8, Math.min(height, Math.sqrt(v) * height * 2.4)), opacity: 0.9 }}
        />
      ))}
    </div>
  );
};

const HostAvatar: React.FC<{ tl: Timeline; size: number }> = ({ tl, size }) => (
  <div
    style={{
      width: size,
      height: size,
      borderRadius: "50%",
      padding: 4,
      background: GRAD,
      flexShrink: 0,
    }}
  >
    <div
      style={{
        width: "100%",
        height: "100%",
        borderRadius: "50%",
        backgroundColor: C.bgElev2,
        backgroundImage: `url(${staticFile(tl.interviewer.image)})`,
        backgroundSize: "330%",
        backgroundPosition: "50% 6%",
      }}
    />
  </div>
);

const YouAvatar: React.FC<{ size: number }> = ({ size }) => (
  <div
    style={{
      width: size,
      height: size,
      borderRadius: "50%",
      background: GRAD_TRI,
      color: "#fff",
      fontFamily: HEAD,
      fontWeight: 900,
      fontSize: size * 0.28,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      flexShrink: 0,
    }}
  >
    KAMU
  </div>
);

const NameTag: React.FC<{ tl: Timeline }> = ({ tl }) => (
  <div
    style={{
      display: "flex",
      alignItems: "center",
      gap: 14,
      background: "rgba(12,15,34,0.85)",
      border: `2px solid ${C.borderStrong}`,
      borderRadius: 999,
      padding: "10px 26px 10px 12px",
      fontFamily: HEAD,
    }}
  >
    <HostAvatar tl={tl} size={56} />
    <span style={{ color: C.text, fontSize: 34, fontWeight: 800 }}>{tl.interviewer.name}</span>
    <span style={{ background: GRAD, color: "#fff", fontSize: 24, fontWeight: 800, padding: "4px 14px", borderRadius: 999 }}>{tl.interviewer.role ?? "面接官"}</span>
  </div>
);

const Badge: React.FC<{ tag: string; text: string; color?: string }> = ({ tag, text, color = "brand" }) => {
  const pop = usePop(4, 0.7);
  const bg = color === "green" ? C.green : color === "red" ? C.red : color === "gold" ? C.gold : GRAD;
  const fg = color === "gold" || color === "green" ? C.bg : "#fff";
  return (
    <div style={{ position: "relative", ...pop }}>
      <div
        style={{
          position: "absolute",
          top: -26,
          left: 28,
          background: bg,
          color: fg,
          fontFamily: HEAD,
          fontSize: 22,
          fontWeight: 900,
          letterSpacing: 2,
          padding: "3px 14px",
          borderRadius: 8,
        }}
      >
        {tag}
      </div>
      <div
        style={{
          background: "rgba(12,15,34,0.92)",
          border: `2px solid ${C.borderStrong}`,
          color: C.text,
          fontFamily: HEAD,
          fontSize: 42,
          fontWeight: 800,
          padding: "16px 34px",
          borderRadius: 22,
          boxShadow: "0 10px 40px rgba(155,77,255,0.35)",
          whiteSpace: "nowrap",
        }}
      >
        {text}
      </div>
    </div>
  );
};

// The host (Yui) as a large cut-out. Breathes, nudges with her own voice.
const Host: React.FC<{ tl: Timeline; beat: Beat; top?: number; punch?: boolean }> = ({ tl, beat, top = 330, punch = false }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const breathe = 1 + Math.sin(frame / 22) * 0.006;
  const talking = beat.speaker !== "candidate" && frame < beat.speechFrames;
  const nod = talking ? Math.abs(Math.sin(frame / 3.2)) * 4 : 0;
  const z = punch ? interpolate(spring({ frame, fps, config: { damping: 12, stiffness: 120 } }), [0, 1], [1.45, 1]) : 1;
  return (
    <div
      style={{
        position: "absolute",
        left: 15,
        top,
        width: 1050,
        height: 1575,
        transform: `translateY(${nod}px) scale(${breathe * z})`,
        transformOrigin: "50% 30%",
      }}
    >
      <div
        style={{
          position: "absolute",
          left: 175,
          top: 120,
          width: 700,
          height: 700,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(255,74,200,0.45) 0%, rgba(155,77,255,0.25) 40%, transparent 70%)",
        }}
      />
      <Img src={staticFile(tl.interviewer.image)} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "contain" }} />
    </div>
  );
};

const BottomFade: React.FC<{ from?: number }> = ({ from = 1250 }) => (
  <div style={{ position: "absolute", left: 0, right: 0, top: from, bottom: 0, background: `linear-gradient(transparent, ${C.bg} 70%)` }} />
);

// ------------------------------------------------------------------ HOOK
// Frame 0 already shows the stake; zoom-punch, flash, shake and an impact hit.

// Listicle teaser: numbered rows with blurred content — the curiosity gap.
const Teaser: React.FC<{ n: number; speechFrames: number }> = ({ n, speechFrames }) => {
  const frame = useCurrentFrame();
  const widths = [78, 62, 88, 55, 70, 66, 80];
  return (
    <div style={{ position: "absolute", top: 1130, left: 70, right: 70, display: "flex", flexDirection: "column", gap: 14 }}>
      {Array.from({ length: n }).map((_, i) => {
        const at = 3 + (i * speechFrames * 0.7) / n;
        const k = interpolate(frame, [at, at + 6], [0, 1], clamp);
        return (
          <div
            key={i}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 20,
              height: 76,
              padding: "0 22px",
              borderRadius: 22,
              background: "rgba(12,15,34,0.88)",
              border: `2px solid ${C.borderStrong}`,
              opacity: k,
              transform: `translateX(${(1 - k) * -60}px)`,
            }}
          >
            <div style={{ minWidth: 52, height: 52, borderRadius: "50%", background: GRAD, color: "#fff", fontFamily: HEAD, fontSize: 30, fontWeight: 900, display: "flex", alignItems: "center", justifyContent: "center" }}>
              {i + 1}
            </div>
            <div style={{ height: 22, width: `${widths[i % widths.length]}%`, borderRadius: 11, background: "linear-gradient(90deg, rgba(249,250,251,0.55), rgba(195,200,216,0.25))", filter: "blur(5px)" }} />
            <div style={{ marginLeft: "auto", color: C.magenta, fontFamily: HEAD, fontSize: 40, fontWeight: 900 }}>?</div>
          </div>
        );
      })}
    </div>
  );
};

// A ¥100 coin drops in, then fines stamp around it while the hook is spoken.
const CoinArt: React.FC<{ speechFrames: number }> = ({ speechFrames }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const drop = spring({ frame: frame - 4, fps, config: { damping: 9, stiffness: 120 } });
  const tags = [0.45, 0.62, 0.79].map((k) => Math.round(speechFrames * k));
  const spots = [{ left: 90, top: 60, r: -10 }, { left: 680, top: 140, r: 8 }, { left: 140, top: 300, r: 6 }];
  return (
    <div style={{ position: "absolute", top: 1210, left: 0, right: 0, height: 420 }}>
      <div style={{ position: "absolute", left: 390, top: 60, width: 300, height: 300, transform: `translateY(${(1 - drop) * -700}px) rotate(${(1 - drop) * -90 + Math.sin(frame / 12) * 4}deg)` }}>
        <div style={{ width: "100%", height: "100%", borderRadius: "50%", background: "radial-gradient(circle at 35% 30%, #F4F1EA, #BFC3CC 55%, #8A8F9C)", border: "10px solid #A7ACB8", boxShadow: "0 30px 80px rgba(0,0,0,0.6), inset 0 0 30px rgba(0,0,0,0.25)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontFamily: HEAD, color: "#5A5F6E" }}>
          <span style={{ fontSize: 120, fontWeight: 900, lineHeight: 1 }}>100</span>
          <span style={{ fontSize: 40, fontWeight: 800 }}>円</span>
        </div>
      </div>
      {tags.map((at, i) => {
        const k = spring({ frame: frame - at, fps, config: { damping: 10, stiffness: 180 } });
        return (
          <div key={i} style={{ position: "absolute", left: spots[i].left, top: spots[i].top, transform: `rotate(${spots[i].r}deg) scale(${k})`, background: C.red, color: "#fff", fontFamily: HEAD, fontSize: 58, fontWeight: 900, padding: "6px 24px", borderRadius: 16, boxShadow: `0 0 40px ${C.red}` }}>
            −¥100
          </div>
        );
      })}
      {tags.map((at, i) => (
        <Sfx key={i} name="pop" at={at} volume={0.5} />
      ))}
    </div>
  );
};

// A newspaper spins in with the impossible headline (swap.from) and a subline (swap.to).
const NewsArt: React.FC<{ swap: NonNullable<Beat["swap"]> }> = ({ swap }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const k = spring({ frame: frame - 3, fps, config: { damping: 12, stiffness: 90 } });
  return (
    <div style={{ position: "absolute", top: 1180, left: 0, right: 0, display: "flex", justifyContent: "center" }}>
      <div style={{ width: 760, padding: "22px 34px 30px", background: "#F2EEE3", boxShadow: "0 30px 90px rgba(0,0,0,0.6)", transform: `rotate(${(1 - k) * 540 - 4}deg) scale(${0.2 + k * 0.8})`, fontFamily: HEAD, color: "#1B1F3A" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", borderBottom: "4px solid #1B1F3A", paddingBottom: 8 }}>
          <span style={{ fontSize: 46, fontWeight: 900, letterSpacing: 2 }}>日本新聞</span>
          <span style={{ fontSize: 24, fontWeight: 700, opacity: 0.6 }}>号外 · BREAKING</span>
        </div>
        <div style={{ fontSize: 62, fontWeight: 900, lineHeight: 1.08, marginTop: 16 }}>{swap.from}</div>
        <div style={{ fontSize: 30, fontWeight: 700, marginTop: 12, opacity: 0.75 }}>{swap.to}</div>
      </div>
    </div>
  );
};

// Floating LED panel that shows a mistake (text) and its fix; switches on with a flicker.
const ErrorScreen: React.FC<{ text: string; fix?: string; tone?: "red" | "green"; scale?: number; fresh?: boolean }> = ({ text, fix, tone = "red", scale = 1, fresh = true }) => {
  const frame = useCurrentFrame();
  const on = fresh ? [0, 1, 0.2, 1, 1][Math.min(4, Math.floor(frame / 2))] : 1;
  const col = tone === "red" ? C.red : C.green;
  return (
    <div style={{ transform: `scale(${scale}) translateY(${Math.sin(frame / 14) * 6}px)`, opacity: on, display: "flex", flexDirection: "column", alignItems: "center" }}>
      <div style={{ minWidth: 380, padding: "16px 30px", borderRadius: 22, background: "rgba(8,6,18,0.94)", border: `4px solid ${col}`, boxShadow: `0 0 60px ${col}, inset 0 0 30px rgba(255,255,255,0.06)`, textAlign: "center", fontFamily: HEAD }}>
        <div style={{ fontSize: 56, fontWeight: 900, color: col, textShadow: `0 0 18px ${col}` }}>{text}</div>
        {fix && <div style={{ fontSize: 42, fontWeight: 900, color: C.green, marginTop: 6, textShadow: `0 0 14px ${C.green}` }}>{fix}</div>}
      </div>
      <div style={{ width: 6, height: 40, background: "rgba(255,255,255,0.35)" }} />
    </div>
  );
};

// Cartoon thought cloud with trailing dots toward the head below it.
const ThoughtCloud: React.FC<{ text: string; scale?: number; fresh?: boolean }> = ({ text, scale = 1, fresh = true }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const k = fresh ? spring({ frame: frame - 2, fps, config: { damping: 11, stiffness: 140 } }) : 1;
  return (
    <div style={{ transform: `scale(${scale * k}) translateY(${Math.sin(frame / 16) * 6}px)`, display: "flex", flexDirection: "column", alignItems: "center" }}>
      <div style={{ maxWidth: 520, padding: "22px 34px", borderRadius: 60, background: "#FFFFFF", boxShadow: "0 0 0 6px rgba(255,255,255,0.35), 0 20px 60px rgba(0,0,0,0.5)", fontFamily: HEAD, fontSize: 38, fontWeight: 800, fontStyle: "italic", color: "#1B1F3A", textAlign: "center", lineHeight: 1.25 }}>
        💭 {text}
      </div>
      <div style={{ width: 30, height: 30, borderRadius: "50%", background: "#fff", marginTop: 8 }} />
      <div style={{ width: 16, height: 16, borderRadius: "50%", background: "#fff", marginTop: 6 }} />
    </div>
  );
};

// Running fine total in yen; counts on from the previous beat's total.
const FineCounter: React.FC<{ fine: NonNullable<NonNullable<Beat["duel"]>["fine"]>; start: number; speechFrames: number }> = ({ fine, start, speechFrames }) => {
  const frame = useCurrentFrame();
  const t0 = Math.round(speechFrames * 0.55);
  const k = interpolate(frame, [t0, t0 + 14], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  const v = k >= 1 ? fine.to : Math.round((start + (fine.to - start) * k) / 100) * 100; // lands on the exact amount
  const hue = fine.tone === "green" ? C.green : C.red;
  const bump = fine.to !== start ? interpolate(frame, [t0 + 12, t0 + 16, t0 + 22], [1, 1.18, 1], clamp) : 1;
  return (
    <div style={{ position: "absolute", top: 1310, left: 0, right: 0, display: "flex", justifyContent: "center" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 18, background: "rgba(5,8,22,0.88)", border: `3px solid ${hue}`, borderRadius: 24, padding: "10px 30px", boxShadow: `0 0 50px ${hue}80`, transform: `scale(${bump})` }}>
        <span style={{ fontFamily: HEAD, fontSize: 34, fontWeight: 800, color: C.muted }}>{fine.label ?? "DENDA"}</span>
        <span style={{ fontFamily: HEAD, fontSize: 72, fontWeight: 900, color: fine.tone ? hue : v ? C.red : C.green }}>¥{v.toLocaleString("de-DE")}</span>
      </div>
      {fine.to !== start && <Sfx name="buzz" at={t0} volume={0.35} />}
    </div>
  );
};

// ¥10,000 notes and ¥ coins tumbling down (seeded, so every render is identical).
const YenRain: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {Array.from({ length: 30 }, (_, i) => {
        const note = i % 3 !== 0;
        const sp = (note ? 15 : 20) + random(`ys${i}`) * 8;
        const start = random(`yt${i}`) * 45 + (i % 2 ? 0 : 90); // two waves: on the cut and when the yen amount lands
        const y = (frame - start) * sp - 260;
        if (frame < start || y > 2000) return null;
        const x = random(`yx${i}`) * 1080 - 100 + Math.sin((frame + i * 13) / 9) * (note ? 60 : 20);
        const spin = (frame + i * 20) * (note ? 4 : 9) * (random(`yr${i}`) > 0.5 ? 1 : -1);
        const flip = Math.cos((frame + i * 7) / 6);
        return note ? (
          <div key={i} style={{ position: "absolute", left: x, top: y, width: 230, height: 112, borderRadius: 8, background: "linear-gradient(135deg, #E9DCC0, #CDB98E 60%, #B8A276)", border: "2px solid #8C7650", boxShadow: "0 10px 24px rgba(0,0,0,0.35)", transform: `rotate(${spin}deg) scaleY(${0.35 + Math.abs(flip) * 0.65})`, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 16px", boxSizing: "border-box", fontFamily: HEAD, color: "#5B4528" }}>
            <span style={{ fontSize: 34, fontWeight: 900 }}>¥</span>
            <span style={{ display: "flex", flexDirection: "column", alignItems: "center", lineHeight: 1 }}>
              <span style={{ fontSize: 34, fontWeight: 900 }}>10000</span>
              <span style={{ fontSize: 16, fontWeight: 800 }}>日本銀行券</span>
            </span>
            <span style={{ width: 34, height: 34, borderRadius: "50%", border: "3px solid #8C7650" }} />
          </div>
        ) : (
          <div key={i} style={{ position: "absolute", left: x, top: y, width: 86, height: 86, borderRadius: "50%", background: "radial-gradient(circle at 35% 30%, #FFF2B0, #F2C14E 45%, #B9861E)", border: "3px solid #9A6E14", boxShadow: "0 0 24px rgba(255,200,80,0.6)", transform: `rotate(${spin}deg) scaleX(${0.25 + Math.abs(flip) * 0.75})`, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: HEAD, fontSize: 46, fontWeight: 900, color: "#7A520C" }}>
            ¥
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

// Two characters on a diagonal split screen, each over their own place, a spinning swap icon on the seam.
const DuoHook: React.FC<{ duo: NonNullable<Beat["duo"]>; beat: Beat; tl: Timeline }> = ({ duo, beat, tl }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const inL = spring({ frame: frame - 4, fps, config: { damping: 14, stiffness: 90 } });
  const inR = spring({ frame: frame - 10, fps, config: { damping: 14, stiffness: 90 } });
  const icon = spring({ frame: frame - 18, fps, config: { damping: 9, stiffness: 120 } });
  const halves = [
    { side: duo.left, clip: "polygon(0 0, 62% 0, 38% 100%, 0 100%)", pan: frame * 0.25 },
    { side: duo.right, clip: "polygon(62% 0, 100% 0, 100% 100%, 38% 100%)", pan: -frame * 0.25 },
  ];
  const person = (p: NonNullable<Beat["duo"]>["left"], left: number, k: number, dir: number) => (
    <div style={{ position: "absolute", left, top: 760, width: 620, height: 925, opacity: interpolate(k, [0, 0.4], [0, 1], clamp), transform: `translateX(${(1 - k) * dir * 320}px)`, transformOrigin: "50% 100%" }}>
      {RIGS[p.image] ? (
        <Puppet image={p.image} width={620} seed={p.name} sway={false} gesture={0.5} />
      ) : (
        <Img src={staticFile(p.image)} style={{ width: "100%", height: "100%", objectFit: "contain" }} />
      )}
      <div style={{ position: "absolute", top: -64, left: 0, right: 0, display: "flex", justifyContent: "center" }}>
        <div style={{ background: "rgba(5,8,22,0.85)", border: `3px solid ${dir < 0 ? C.purple : C.orange}`, borderRadius: 999, padding: "6px 24px", fontFamily: HEAD, fontSize: 38, fontWeight: 900, color: C.text }}>{p.name}</div>
      </div>
    </div>
  );
  return (
    <AbsoluteFill style={{ background: C.bg }}>
      {halves.map((h, i) => (
        <AbsoluteFill key={i} style={{ clipPath: h.clip }}>
          <Img src={staticFile(h.side.bg)} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", transform: `scale(1.12) translateX(${h.pan}px)` }} />
        </AbsoluteFill>
      ))}
      <svg width={1080} height={1920} style={{ position: "absolute", inset: 0 }}>
        <defs>
          <linearGradient id="seam" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={C.purple} />
            <stop offset="1" stopColor={C.magenta} />
          </linearGradient>
        </defs>
        <line x1={670} y1={0} x2={410} y2={1920} stroke="url(#seam)" strokeWidth={10} style={{ filter: "drop-shadow(0 0 18px #FF4AC8)" }} />
      </svg>
      <AbsoluteFill style={{ background: "linear-gradient(180deg, rgba(5,8,22,0.95) 0%, rgba(5,8,22,0.6) 28%, rgba(5,8,22,0) 42%, rgba(5,8,22,0) 75%, rgba(5,8,22,0.85) 100%)" }} />
      {[
        { t: duo.left.place, x: 60, k: inL },
        { t: duo.right.place, x: 1080 - 60 - 360, k: inR },
      ].map((pl, i) => (
        <div key={i} style={{ position: "absolute", top: 610, left: pl.x, width: 360, display: "flex", justifyContent: i ? "flex-end" : "flex-start", opacity: pl.k }}>
          <div style={{ background: "rgba(5,8,22,0.75)", color: C.text, fontFamily: HEAD, fontSize: 40, fontWeight: 900, letterSpacing: 4, padding: "8px 24px", borderRadius: 16 }}>{pl.t}</div>
        </div>
      ))}
      {person(duo.left, -40, inL, -1)}
      {person(duo.right, 500, inR, 1)}
      <div style={{ position: "absolute", top: 1090, left: 540 - 85, width: 170, height: 170, borderRadius: "50%", background: GRAD, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 92, color: "#fff", fontWeight: 900, boxShadow: "0 0 60px rgba(255,74,200,0.8)", transform: `scale(${icon}) rotate(${(1 - icon) * -180 + Math.sin(frame / 12) * 6}deg)` }}>
        {duo.icon ?? "⇄"}
      </div>
      <div style={{ position: "absolute", bottom: 330, left: 0, right: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 20 }}>
        <Wave src={beat.audio} height={60} />
        <NameTag tl={tl} />
      </div>
      <Sfx name="whoosh" at={4} volume={0.5} />
      <Sfx name="whoosh" at={10} volume={0.5} />
      <Sfx name="pop" at={18} volume={0.6} />
    </AbsoluteFill>
  );
};

export const HookScene: React.FC<SceneProps> = ({ beat, tl }) => {
  const frame = useCurrentFrame();
  const shake = frame < 10 ? Math.sin(frame * 2.7) * (10 - frame) * 2.2 : 0;
  const flash = interpolate(frame, [0, 1, 5], [0, 0.55, 0], clamp);
  const qPop = usePop(4, 1.4);
  const long = stripMarkup(beat.title ?? "").length > 45; // 4-line title: smaller, Yui lower
  return (
    <AbsoluteFill style={{ transform: `translate(${shake}px, ${-shake * 0.6}px)` }}>
      {beat.duo ? (
        <DuoHook duo={beat.duo} beat={beat} tl={tl} />
      ) : (
        <>
          <Bg glow={1.4} />
          <Host tl={tl} beat={beat} top={long ? 560 : 420} punch />
          <BottomFade from={1150} />
        </>
      )}
      {beat.money && <YenRain />}
      {beat.money && [6, 14, 24, 36].map((t) => <Sfx key={t} name="ding" at={t} volume={0.25} />)}
      <div style={{ position: "absolute", top: 120, left: 60, right: 60, display: "flex", flexDirection: "column", alignItems: "center", gap: 26 }}>
        {tl.series && (
          <div style={{ background: GRAD, color: "#fff", fontFamily: HEAD, fontSize: 30, fontWeight: 900, letterSpacing: 3, padding: "8px 26px", borderRadius: 999 }}>
            {tl.series.toUpperCase()}
          </div>
        )}
        {beat.title && <Caption text={beat.title} speechFrames={beat.speechFrames} size={long ? 84 : 94} instant />}
      </div>
      {beat.duo ? null : beat.swap?.kind === "coin" ? (
        <CoinArt speechFrames={beat.speechFrames} />
      ) : beat.swap?.kind === "screen" ? (
        <div style={{ position: "absolute", top: 1240, left: 0, right: 0, display: "flex", justifyContent: "center" }}>
          <ErrorScreen text={beat.swap.from} fix={frame > beat.speechFrames * 0.6 ? beat.swap.to : undefined} scale={1.3} />
          <Sfx name="buzz" at={2} volume={0.4} />
        </div>
      ) : beat.swap?.kind === "thought" ? (
        <div style={{ position: "absolute", top: 1250, left: 0, right: 0, display: "flex", justifyContent: "center" }}>
          <Sequence from={Math.round(beat.speechFrames * 0.45)} layout="none">
            <ThoughtCloud text={beat.swap.from} scale={1.25} />
            <Sfx name="pop" volume={0.5} />
          </Sequence>
        </div>
      ) : beat.swap?.kind === "news" ? (
        <NewsArt swap={beat.swap} />
      ) : beat.swap ? (
        <SwapArt swap={beat.swap} speechFrames={beat.speechFrames} />
      ) : beat.teaser ? (
        <Teaser n={beat.teaser} speechFrames={beat.speechFrames} />
      ) : (
      <div style={{ position: "absolute", top: 1260, left: 50, right: 50, ...qPop }}>
        <div
          style={{
            background: "rgba(12,15,34,0.9)",
            border: "4px solid transparent",
            backgroundImage: `linear-gradient(rgba(12,15,34,0.94), rgba(12,15,34,0.94)), ${GRAD_TRI}`,
            backgroundOrigin: "border-box",
            backgroundClip: "padding-box, border-box",
            borderRadius: 36,
            padding: "34px 40px",
            boxShadow: "0 0 80px rgba(255,74,200,0.4)",
          }}
        >
          <Caption text={captionOf(beat)} speechFrames={beat.speechFrames} size={86} />
          {beat.sub && <Sub text={beat.sub} delay={beat.speechFrames * 0.5} />}
        </div>
      </div>
      )}
      <AbsoluteFill style={{ background: "#fff", opacity: flash }} />
      <Sfx name="impact" volume={0.8} />
    </AbsoluteFill>
  );
};

// ------------------------------------------------------------------ HOST (talks to camera)
// Yui large, caption on top, optional lower-third badge, live voice bars.

export const HostScene: React.FC<SceneProps> = ({ beat, prev, tl }) => {
  const enter = !sameScene(prev, beat);
  const badgeNew = beat.badge && prev?.badge?.text !== beat.badge.text;
  return (
    <AbsoluteFill>
      <Bg />
      <Enter on={enter}>
        <Host tl={tl} beat={beat} top={470} />
        <BottomFade />
      </Enter>
      <div style={{ position: "absolute", top: 130, left: 60, right: 60 }}>
        <Caption text={captionOf(beat)} speechFrames={beat.speechFrames} size={78} />
        {beat.sub && <Sub text={beat.sub} delay={beat.speechFrames * 0.6} />}
      </div>
      {beat.badge && (
        <div style={{ position: "absolute", top: 1290, left: 0, right: 0, display: "flex", justifyContent: "center" }}>
          <Badge {...beat.badge} />
        </div>
      )}
      <div style={{ position: "absolute", bottom: 330, left: 0, right: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 24 }}>
        <Wave src={beat.audio} />
        <NameTag tl={tl} />
      </div>
      {enter && <Sfx name="whoosh" volume={0.35} />}
      {badgeNew && <Sfx name={beat.badge!.color === "green" ? "ding" : "pop"} at={4} volume={0.45} />}
    </AbsoluteFill>
  );
};

// ------------------------------------------------------------------ CHAT
// The viewer ("KAMU") answers in an app-style chat: the host's question comes in, your answer
// is typed into a gradient bubble, mistakes get counted, then the stamp.

const Chips: React.FC<{ chips: string[]; prevCount: number; ok: boolean; speechFrames: number }> = ({ chips, prevCount, ok, speechFrames }) => {
  const frame = useCurrentFrame();
  const step = (speechFrames * 0.9) / Math.max(1, chips.length - prevCount);
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 14, justifyContent: "flex-end" }}>
      {chips.map((c, i) => {
        const fresh = i >= prevCount;
        const at = (i - prevCount + 1) * step - 6;
        const k = fresh ? interpolate(frame, [at, at + 7], [0, 1], clamp) : 1;
        return (
          <div
            key={i}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              background: ok ? "rgba(65,213,154,0.16)" : "rgba(255,77,109,0.16)",
              border: `2px solid ${ok ? C.green : C.red}`,
              color: C.text,
              borderRadius: 999,
              padding: "6px 22px 6px 8px",
              fontFamily: HEAD,
              fontSize: 32,
              fontWeight: 800,
              opacity: k,
              transform: `scale(${0.7 + 0.3 * k})`,
            }}
          >
            <span style={{ width: 38, height: 38, borderRadius: "50%", background: ok ? C.green : C.red, color: C.bg, fontSize: 24, display: "flex", alignItems: "center", justifyContent: "center" }}>
              {ok ? "✓" : "✕"}
            </span>
            {c}
          </div>
        );
      })}
    </div>
  );
};

const Stamp: React.FC<{ text: string; color: string; fresh: boolean }> = ({ text, color, fresh }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = fresh ? spring({ frame: frame - 2, fps, config: { damping: 10, stiffness: 220 } }) : 1;
  return (
    <div
      style={{
        transform: `rotate(-8deg) scale(${interpolate(s, [0, 1], [2.4, 1])})`,
        opacity: interpolate(s, [0, 0.3], [0, 1], clamp),
        border: `10px solid ${color}`,
        color,
        background: "rgba(5,8,22,0.8)",
        fontFamily: HEAD,
        fontSize: 104,
        fontWeight: 900,
        letterSpacing: 6,
        padding: "4px 40px",
        borderRadius: 18,
        boxShadow: `0 0 60px ${color}`,
      }}
    >
      {text}
    </div>
  );
};

export const ChatScene: React.FC<SceneProps> = ({ beat, prev, tl }) => {
  const frame = useCurrentFrame();
  const enter = !sameScene(prev, beat);
  const prevChips = prev?.scene === "chat" ? prev.chips?.length ?? 0 : 0;
  const stampFresh = !!beat.stamp && prev?.stamp !== beat.stamp;
  const stampColor = beat.stampColor === "green" ? C.green : C.red;
  const stampAt = Math.max(0, beat.speechFrames - 4);
  const shake = stampFresh && frame >= stampAt && frame < stampAt + 10 ? Math.sin(frame * 3) * (stampAt + 10 - frame) * 2 : 0;
  const mine = beat.speaker === "candidate";
  return (
    <AbsoluteFill style={{ transform: `translateX(${shake}px)` }}>
      <Bg />
      {/* app header */}
      <div style={{ position: "absolute", top: 170, left: 50, right: 50, display: "flex", alignItems: "center", gap: 20, padding: "18px 26px", background: C.bgElev, border: `2px solid ${C.border}`, borderRadius: 28 }}>
        <HostAvatar tl={tl} size={84} />
        <div style={{ flex: 1, fontFamily: HEAD }}>
          <div style={{ color: C.text, fontSize: 36, fontWeight: 800 }}>{tl.interviewer.name}</div>
          <div style={{ color: C.dim, fontSize: 26, fontWeight: 600 }}>Mode Mensetsu · 面接練習</div>
        </div>
        <div style={{ width: 16, height: 16, borderRadius: "50%", background: C.green, boxShadow: `0 0 16px ${C.green}` }} />
      </div>
      <Enter on={enter}>
        {beat.quote && (
          <div style={{ position: "absolute", top: 390, left: 50, right: 200, display: "flex", gap: 18, alignItems: "flex-end" }}>
            <HostAvatar tl={tl} size={72} />
            <div style={{ background: C.bgElev2, border: `2px solid ${C.border}`, color: C.text, fontFamily: HEAD, fontSize: 46, fontWeight: 700, padding: "24px 30px", borderRadius: "30px 30px 30px 8px" }}>
              {beat.quote}
            </div>
          </div>
        )}
      </Enter>
      <div style={{ position: "absolute", top: beat.quote ? 610 : 420, left: 120, right: 50, display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 26 }}>
        <div style={{ display: "flex", gap: 18, alignItems: "flex-end", justifyContent: "flex-end", width: "100%" }}>
          <div
            style={{
              background: mine ? GRAD : C.bgElev2,
              border: mine ? "none" : `2px solid ${C.border}`,
              padding: "30px 36px",
              borderRadius: mine ? "34px 34px 8px 34px" : "34px 34px 34px 8px",
              maxWidth: 760,
              boxShadow: mine ? "0 20px 60px rgba(255,74,200,0.35)" : "none",
            }}
          >
            <Caption text={captionOf(beat)} speechFrames={beat.speechFrames} size={60} align="left" color="#fff" />
            {beat.sub && <Sub text={beat.sub} delay={beat.speechFrames * 0.5} align="left" />}
          </div>
          {mine && <YouAvatar size={90} />}
        </div>
        {beat.chips && <Chips chips={beat.chips} prevCount={prevChips} ok={beat.stampColor === "green"} speechFrames={beat.speechFrames} />}
      </div>
      {beat.stamp && (frame >= stampAt || !stampFresh) && (
        <div style={{ position: "absolute", top: 1120, left: 0, right: 0, display: "flex", justifyContent: "center" }}>
          <Sequence from={stampFresh ? stampAt : 0} layout="none">
            <Stamp text={beat.stamp} color={stampColor} fresh={stampFresh} />
          </Sequence>
        </div>
      )}
      {/* press-to-talk bar */}
      <div style={{ position: "absolute", bottom: 330, left: 60, right: 60, height: 130, borderRadius: 999, background: mine ? GRAD : C.bgElev2, border: `2px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "center", gap: 24 }}>
        {mine && frame < beat.speechFrames ? (
          <Wave src={beat.audio} height={70} />
        ) : (
          <span style={{ color: C.muted, fontFamily: HEAD, fontSize: 34, fontWeight: 700 }}>🎙 Tekan untuk bicara</span>
        )}
      </div>
      {enter && <Sfx name="pop" volume={0.4} />}
      {stampFresh && <Sfx name={beat.stampColor === "green" ? "ding" : "buzz"} at={stampAt} volume={0.5} />}
      {stampFresh && <Sfx name="impact" at={stampAt} volume={0.6} />}
    </AbsoluteFill>
  );
};

// ------------------------------------------------------------------ CARD
// Elevated brand card whose rows build up, spread across the spoken line.

const RowView: React.FC<{ row: CardRow; fresh: boolean; delay: number }> = ({ row, fresh, delay }) => {
  const frame = useCurrentFrame();
  const k = fresh ? interpolate(frame, [delay, delay + 8], [0, 1], clamp) : 1;
  const strike = row.kind === "no" ? interpolate(frame, [fresh ? delay + 12 : -20, fresh ? delay + 24 : -10], [0, 1], clamp) : 0;
  const pill = row.kind === "no" ? C.red : row.kind === "yes" ? C.green : C.gold;
  return (
    <div
      style={{
        background: C.row,
        border: "2px solid rgba(255,255,255,0.08)",
        borderRadius: 24,
        padding: "20px 26px",
        display: "flex",
        alignItems: "center",
        gap: 20,
        opacity: k,
        transform: `translateY(${(1 - k) * 24}px)`,
      }}
    >
      {row.kind === "num" && (
        <div style={{ minWidth: 58, height: 58, borderRadius: "50%", background: GRAD, color: "#fff", fontFamily: HEAD, fontWeight: 900, fontSize: 32, display: "flex", alignItems: "center", justifyContent: "center" }}>
          {row.n}
        </div>
      )}
      <div style={{ flex: 1 }}>
        {row.label && (
          <div style={{ display: "inline-block", background: pill, color: C.bg, fontFamily: HEAD, fontSize: 20, fontWeight: 900, letterSpacing: 2, padding: "3px 12px", borderRadius: 8, marginBottom: 8 }}>
            {row.label}
          </div>
        )}
        <div>
          <div style={{ position: "relative", display: "inline-block", color: row.kind === "no" ? C.dim : C.text, fontFamily: HEAD, fontSize: 44, fontWeight: 800, lineHeight: 1.2 }}>
            {row.text}
            {row.kind === "no" && <div style={{ position: "absolute", left: 0, top: "52%", height: 5, width: `${strike * 100}%`, background: C.red, borderRadius: 3 }} />}
          </div>
        </div>
      </div>
      {(row.kind === "no" || row.kind === "yes") && (
        <div style={{ minWidth: 56, height: 56, borderRadius: "50%", background: row.kind === "no" ? C.red : C.green, color: C.bg, fontSize: 32, fontWeight: 900, display: "flex", alignItems: "center", justifyContent: "center" }}>
          {row.kind === "no" ? "✕" : "✓"}
        </div>
      )}
    </div>
  );
};

const CardIcon: React.FC<{ icon: NonNullable<NonNullable<Beat["card"]>["icon"]> }> = ({ icon }) => {
  const map: Record<string, [string, string]> = { "?": [GRAD, "?"], "!": [C.gold, "!"], check: [C.green, "✓"], x: [C.red, "✕"] };
  const [bg, ch] = typeof icon === "number" ? [GRAD, String(icon)] : map[icon];
  return (
    <div style={{ minWidth: 76, height: 76, borderRadius: 22, background: bg, color: bg === C.gold || bg === C.green ? C.bg : "#fff", fontFamily: HEAD, fontSize: 44, fontWeight: 900, display: "flex", alignItems: "center", justifyContent: "center" }}>
      {ch}
    </div>
  );
};

const HostCaption: React.FC<{ beat: Beat; tl: Timeline; top: number }> = ({ beat, tl, top }) => {
  if (!beat.say && !beat.caption) return null;
  return (
    <div style={{ position: "absolute", top, left: 60, right: 60, display: "flex", gap: 26, alignItems: "flex-start" }}>
      {beat.speaker === "candidate" ? <YouAvatar size={120} /> : <HostAvatar tl={tl} size={120} />}
      <div style={{ flex: 1, paddingTop: 10 }}>
        <Caption text={captionOf(beat)} speechFrames={beat.speechFrames} size={58} align="left" />
        {beat.sub && <Sub text={beat.sub} delay={beat.speechFrames * 0.5} align="left" />}
      </div>
    </div>
  );
};

export const CardScene: React.FC<SceneProps> = ({ beat, prev, tl }) => {
  const card = beat.card!;
  const cont = sameScene(prev, beat);
  const prevRows = cont ? prev!.card!.rows.length : 0;
  const newRows = card.rows.length - prevRows;
  const frame = useCurrentFrame();
  const gap = newRows > 1 ? (beat.speechFrames * 0.75) / newRows : 0;
  const noteAt = 8 + gap * newRows;
  const noteFresh = !cont || prev!.card!.note !== card.note;
  return (
    <AbsoluteFill>
      <Bg />
      <Enter on={!cont}>
        <div
          style={{
            position: "absolute",
            top: 160,
            left: 60,
            right: 60,
            background: `linear-gradient(160deg, #1B2142, #0A0E22)`,
            border: `2px solid ${C.borderStrong}`,
            borderRadius: 40,
            padding: "40px 36px 44px",
            boxShadow: "0 30px 80px rgba(155,77,255,0.3)",
            display: "flex",
            flexDirection: "column",
            gap: 22,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 24, marginBottom: 6 }}>
            {card.icon !== undefined && <CardIcon icon={card.icon} />}
            <div>
              {card.kicker && <div style={{ color: C.dim, fontFamily: HEAD, fontSize: 24, fontWeight: 800, letterSpacing: 3 }}>{card.kicker.toUpperCase()}</div>}
              <div style={{ color: C.text, fontFamily: HEAD, fontSize: 58, fontWeight: 900, lineHeight: 1.1 }}>{card.title}</div>
            </div>
          </div>
          {card.rows.map((r, i) => (
            <RowView key={i} row={r} fresh={i >= prevRows} delay={(i - prevRows) * gap} />
          ))}
          {card.note && (
            <div style={{ alignSelf: "center", background: GRAD, color: "#fff", fontFamily: HEAD, fontSize: 32, fontWeight: 800, padding: "10px 28px", borderRadius: 999, opacity: noteFresh ? interpolate(frame, [noteAt, noteAt + 8], [0, 1], clamp) : 1 }}>
              {card.note}
            </div>
          )}
        </div>
      </Enter>
      <HostCaption beat={beat} tl={tl} top={1280} />
      {card.rows.map((_, i) => (i >= prevRows ? <Sfx key={i} name="pop" at={(i - prevRows) * gap} volume={0.35} /> : null))}
      {!cont && <Sfx name="whoosh" volume={0.3} />}
    </AbsoluteFill>
  );
};

// ------------------------------------------------------------------ LEDGER (money table, row by row)

const yenFmt = (n: number) => "¥" + Math.round(n).toLocaleString("de-DE");

const LedgerLine: React.FC<{ row: LedgerRow; fresh: boolean; delay: number }> = ({ row, fresh, delay }) => {
  const frame = useCurrentFrame();
  const k = fresh ? interpolate(frame, [delay, delay + 8], [0, 1], clamp) : 1;
  const count = fresh ? interpolate(frame, [delay, delay + 14], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) }) : 1;
  const kind = row.kind ?? "minus";
  const big = kind === "total" || kind === "save" || kind === "send";
  const hue = kind === "minus" ? C.red : kind === "save" ? C.gold : kind === "send" ? C.green : C.text;
  const sign = kind === "minus" ? "−" : "";
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 16,
        padding: big ? "12px 22px" : "6px 22px",
        borderRadius: 18,
        background: kind === "total" ? "linear-gradient(90deg, rgba(155,77,255,0.35), rgba(255,74,200,0.25))" : big ? "rgba(255,255,255,0.07)" : "transparent",
        borderTop: kind === "total" ? `2px solid ${C.borderStrong}` : "none",
        opacity: k,
        transform: `translateX(${(1 - k) * -30}px)`,
      }}
    >
      {row.icon && <span style={{ fontSize: big ? 44 : 34 }}>{row.icon}</span>}
      <span style={{ flex: 1, color: kind === "minus" ? C.muted : C.text, fontFamily: HEAD, fontSize: big ? 42 : 34, fontWeight: big ? 900 : 700 }}>{row.label}</span>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
        <span style={{ color: hue, fontFamily: HEAD, fontSize: big ? 50 : 36, fontWeight: 900 }}>
          {sign}
          {yenFmt(row.yen * count)}
        </span>
        {row.rp && <span style={{ color: kind === "send" || kind === "save" ? hue : C.dim, fontFamily: HEAD, fontSize: big ? 32 : 24, fontWeight: 800 }}>{row.rp}</span>}
      </div>
    </div>
  );
};

export const LedgerScene: React.FC<SceneProps> = ({ beat, prev, tl }) => {
  const lg = beat.ledger!;
  const cont = prev?.scene === "ledger" && prev.ledger?.title === lg.title;
  const prevRows = cont ? prev!.ledger!.rows.length : Math.max(0, lg.rows.length - (lg.fresh ?? lg.rows.length));
  const newRows = lg.rows.length - prevRows;
  const gap = newRows > 1 ? (beat.speechFrames * 0.7) / newRows : 0;
  const delay = (i: number) => 4 + (i - prevRows) * gap;
  return (
    <AbsoluteFill>
      <Bg />
      <Enter on={!cont}>
        <div
          style={{
            position: "absolute",
            top: 130,
            left: 50,
            right: 50,
            background: "linear-gradient(160deg, #1B2142, #0A0E22)",
            border: `2px solid ${C.borderStrong}`,
            borderRadius: 36,
            padding: "30px 22px 30px",
            boxShadow: "0 30px 80px rgba(155,77,255,0.3)",
            display: "flex",
            flexDirection: "column",
            gap: 4,
          }}
        >
          <div style={{ padding: "0 22px 12px" }}>
            {lg.kicker && <div style={{ color: C.dim, fontFamily: HEAD, fontSize: 24, fontWeight: 800, letterSpacing: 3 }}>{lg.kicker.toUpperCase()}</div>}
            <div style={{ color: C.text, fontFamily: HEAD, fontSize: 52, fontWeight: 900, lineHeight: 1.1 }}>{lg.title}</div>
          </div>
          {lg.rows.map((r, i) => (
            <LedgerLine key={i} row={r} fresh={i >= prevRows} delay={delay(i)} />
          ))}
          {lg.note && <div style={{ padding: "12px 22px 0", color: C.dim, fontFamily: BODY, fontSize: 24, fontWeight: 700 }}>{lg.note}</div>}
        </div>
      </Enter>
      <HostCaption beat={beat} tl={tl} top={1480} />
      {lg.rows.map((r, i) => (i >= prevRows ? <Sfx key={i} name={r.kind === "send" || r.kind === "save" ? "ding" : "pop"} at={delay(i)} volume={0.35} /> : null))}
      {!cont && <Sfx name="whoosh" volume={0.3} />}
    </AbsoluteFill>
  );
};

// ------------------------------------------------------------------ STEP
// Gradient ring with the step number.

export const StepScene: React.FC<SceneProps> = ({ beat, tl }) => {
  const frame = useCurrentFrame();
  const st = beat.step!;
  const ring = interpolate(frame, [0, 16], [0, 1], clamp);
  const pop = usePop(3, 0.5);
  const word = usePop(8, 0.8);
  const R = 230;
  const circ = 2 * Math.PI * R;
  return (
    <AbsoluteFill>
      <Bg glow={1.2} />
      <div style={{ position: "absolute", top: 300, left: 0, right: 0, display: "flex", justifyContent: "center" }}>
        <div style={{ border: `2px solid ${C.borderStrong}`, color: C.text, fontFamily: HEAD, fontSize: 30, fontWeight: 800, letterSpacing: 4, padding: "8px 26px", borderRadius: 999, background: C.bgElev }}>
          {(st.kicker ?? `RUMUS ${st.of} LANGKAH`).toUpperCase()}
        </div>
      </div>
      <svg width={600} height={600} style={{ position: "absolute", left: 240, top: 400 }}>
        <defs>
          <linearGradient id="ring" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={C.purple} />
            <stop offset="50%" stopColor={C.magenta} />
            <stop offset="100%" stopColor={C.orange} />
          </linearGradient>
        </defs>
        <circle cx={300} cy={300} r={R} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={18} />
        <circle cx={300} cy={300} r={R} fill="none" stroke="url(#ring)" strokeWidth={18} strokeDasharray={circ} strokeDashoffset={circ * (1 - ring)} transform="rotate(-90 300 300)" strokeLinecap="round" />
      </svg>
      <div style={{ position: "absolute", left: 340, top: 500, width: 400, height: 400, borderRadius: "50%", background: C.bgElev2, boxShadow: "0 0 90px rgba(255,74,200,0.35)", color: "#fff", fontFamily: HEAD, fontSize: 250, fontWeight: 900, display: "flex", alignItems: "center", justifyContent: "center", ...pop }}>
        <GradText grad={GRAD_TRI}>{st.n}</GradText>
      </div>
      <div style={{ position: "absolute", top: 1030, left: 0, right: 0, display: "flex", justifyContent: "center", ...word }}>
        <span style={{ background: GRAD, padding: "4px 30px", borderRadius: 16, fontFamily: HEAD, fontSize: 120, fontWeight: 900, color: "#fff" }}>{st.word}</span>
      </div>
      <div style={{ position: "absolute", top: 1230, left: 0, right: 0, display: "flex", justifyContent: "center", gap: 18 }}>
        {Array.from({ length: st.of }).map((_, i) => (
          <div key={i} style={{ width: 56, height: 56, borderRadius: "50%", border: `3px solid ${C.borderStrong}`, background: i + 1 === st.n ? GRAD : i + 1 < st.n ? C.bgElev2 : "transparent", color: C.text, fontFamily: HEAD, fontSize: 28, fontWeight: 900, display: "flex", alignItems: "center", justifyContent: "center" }}>
            {i + 1}
          </div>
        ))}
      </div>
      <HostCaption beat={beat} tl={tl} top={1420} />
      <Sfx name="whoosh" volume={0.4} />
    </AbsoluteFill>
  );
};

// ------------------------------------------------------------------ POINT
// Listicle item: progress, big gradient number + the overlay text, VO caption, Yui below.
// Consecutive beats with the same point number continue without re-entering.

export const PointScene: React.FC<SceneProps> = ({ beat, prev, tl }) => {
  const frame = useCurrentFrame();
  const pt = beat.point!;
  const cont = prev?.scene === "point" && prev.point?.n === pt.n;
  const num = usePop(0, 0.3);
  const txt = usePop(5, 0.85);
  const jpq = isJapanese(pt.text); // the item is an interview question in Japanese
  const jpSize = Math.min(60, Math.floor(740 / stripMarkup(pt.text).length));
  const asking = isJapanese(captionOf(beat)); // Yui is saying the question itself
  return (
    <AbsoluteFill>
      <Bg glow={1.1} />
      <Host tl={tl} beat={beat} top={980} />
      <BottomFade from={1500} />
      <div style={{ position: "absolute", top: 170, left: 0, right: 0, display: "flex", justifyContent: "center", gap: 14 }}>
        {Array.from({ length: pt.of }).map((_, i) => (
          <div
            key={i}
            style={{
              width: i + 1 === pt.n ? 90 : 44,
              height: 14,
              borderRadius: 7,
              background: i + 1 === pt.n ? GRAD : i + 1 < pt.n ? "rgba(155,77,255,0.6)" : "rgba(255,255,255,0.15)",
            }}
          />
        ))}
      </div>
      <div
        style={{
          position: "absolute",
          top: 240,
          left: 50,
          right: 50,
          padding: "34px 40px 40px",
          borderRadius: 40,
          border: "4px solid transparent",
          backgroundImage: `linear-gradient(160deg, #1B2142, #0A0E22), ${GRAD_TRI}`,
          backgroundOrigin: "border-box",
          backgroundClip: "padding-box, border-box",
          boxShadow: "0 30px 90px rgba(155,77,255,0.35)",
          display: "flex",
          alignItems: "center",
          gap: 30,
          ...(cont ? {} : txt),
        }}
      >
        <div style={{ fontFamily: HEAD, fontSize: jpq ? 170 : 210, fontWeight: 900, lineHeight: 0.9, ...(cont ? {} : num) }}>
          <GradText grad={GRAD_TRI}>{pt.n}</GradText>
        </div>
        <div style={{ flex: 1 }}>
          {pt.tag && (
            <div style={{ display: "inline-block", background: C.red, color: "#fff", fontFamily: HEAD, fontSize: 24, fontWeight: 900, letterSpacing: 2, padding: "4px 14px", borderRadius: 8, marginBottom: 12 }}>
              {pt.tag}
            </div>
          )}
          <Caption text={pt.text} speechFrames={beat.speechFrames} size={jpq ? jpSize : 72} align="left" instant />
          {pt.romaji && <div style={{ marginTop: 14, color: C.dim, fontFamily: BODY, fontSize: 32, fontWeight: 600, fontStyle: "italic" }}>{pt.romaji}</div>}
          {pt.arti && <div style={{ marginTop: 10, color: C.text, fontFamily: BODY, fontSize: 38, fontWeight: 700 }}>“{pt.arti}”</div>}
        </div>
      </div>
      <div
        style={{
          position: "absolute",
          top: jpq ? 730 : 690,
          left: 30,
          right: 30,
          padding: "30px 30px 40px",
          borderRadius: 40,
          background: "radial-gradient(ellipse at 50% 45%, rgba(5,8,22,0.82) 0%, rgba(5,8,22,0.6) 55%, rgba(5,8,22,0) 78%)",
        }}
      >
        <Caption text={captionOf(beat)} speechFrames={beat.speechFrames} size={asking ? Math.min(84, Math.floor(960 / stripMarkup(captionOf(beat)).length)) : jpq ? 60 : 66} />
        {asking && pt.arti && <Sub text={pt.arti} delay={beat.speechFrames * 0.6} />}
      </div>
      <div style={{ position: "absolute", bottom: 330, left: 0, right: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 24 }}>
        <Wave src={beat.audio} />
        <NameTag tl={tl} />
      </div>
      {!cont && <Sfx name="whoosh" volume={0.4} />}
      {!cont && <Sfx name="pop" at={5} volume={0.35} />}
      {pt.tag && !cont && frame >= 0 && <Sfx name="buzz" at={6} volume={0.3} />}
    </AbsoluteFill>
  );
};

// ------------------------------------------------------------------ JP
// Japanese answer card typed in sync with the speech, then romaji + arti.

export const JpScene: React.FC<SceneProps> = ({ beat, prev, tl }) => {
  const frame = useCurrentFrame();
  const jp = beat.jp!;
  const enter = !(prev?.scene === "jp" && prev.jp?.kicker === jp.kicker);
  const after = Math.max(8, beat.speechFrames * 0.55);
  const k = interpolate(frame, [after, after + 10], [0, 1], clamp);
  const mine = beat.speaker !== "interviewer";
  return (
    <AbsoluteFill>
      <Bg />
      <Enter on={enter}>
        <div
          style={{
            position: "absolute",
            top: 240,
            left: 60,
            right: 60,
            border: "4px solid transparent",
            backgroundImage: `linear-gradient(160deg, #1B2142, #0A0E22), ${GRAD_TRI}`,
            backgroundOrigin: "border-box",
            backgroundClip: "padding-box, border-box",
            borderRadius: 40,
            padding: "40px 40px 48px",
            boxShadow: "0 30px 90px rgba(155,77,255,0.35)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 28 }}>
            <div style={{ color: C.muted, fontFamily: HEAD, fontSize: 26, fontWeight: 800, letterSpacing: 3 }}>
              <GradText>● </GradText>
              {(jp.kicker ?? "CONTOH JAWABAN").toUpperCase()}
            </div>
            <div style={{ background: GRAD, color: "#fff", fontFamily: HEAD, fontSize: 24, fontWeight: 800, padding: "4px 16px", borderRadius: 999 }}>日本語</div>
          </div>
          <div style={{ background: C.row, borderRadius: 26, padding: "34px 34px" }}>
            <Caption text={jp.text} speechFrames={beat.speechFrames} size={76} align="left" />
          </div>
          {jp.romaji && <div style={{ marginTop: 26, color: C.dim, fontFamily: BODY, fontSize: 38, fontWeight: 600, fontStyle: "italic", opacity: k }}>{jp.romaji}</div>}
          {jp.arti && <div style={{ marginTop: 18, color: C.green, fontFamily: BODY, fontSize: 44, fontWeight: 800, opacity: k, lineHeight: 1.3 }}>“{jp.arti}”</div>}
        </div>
      </Enter>
      <div style={{ position: "absolute", bottom: 330, left: 60, right: 60, display: "flex", alignItems: "center", gap: 26, padding: "22px 30px", borderRadius: 999, background: mine ? GRAD : C.bgElev2, border: `2px solid ${C.border}` }}>
        {mine ? <YouAvatar size={100} /> : <HostAvatar tl={tl} size={100} />}
        <div style={{ flex: 1, display: "flex", justifyContent: "center" }}>
          <Wave src={beat.audio} height={80} />
        </div>
      </div>
      {enter && <Sfx name="whoosh" volume={0.3} />}
    </AbsoluteFill>
  );
};

// ------------------------------------------------------------------ APP
// The real Convopartner screen in a floating phone.

export const AppScene: React.FC<SceneProps> = ({ beat, prev, tl }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const app = beat.app!;
  const media = app.video ?? app.screen;
  const cont = prev?.scene === "app" && (prev.app?.video ?? prev.app?.screen) === media;
  const s = cont ? 1 : spring({ frame, fps, config: { damping: 14, stiffness: 90 } });
  const float = Math.sin(frame / 18) * 10;
  const badgePop = usePop(12, 0.6);
  return (
    <AbsoluteFill>
      <Bg glow={1.5} />
      <div style={{ position: "absolute", top: 110, left: 60, right: 60 }}>
        <Caption text={captionOf(beat)} speechFrames={beat.speechFrames} size={app.demo ? 58 : 70} />
      </div>
      <div
        style={{
          position: "absolute",
          ...(app.demo ? { left: 225, top: 430, width: 630, height: 1360 } : { left: 250, top: 520, width: 580, height: 1290 }),
          borderRadius: 70,
          padding: 16,
          background: "#1B1F3A",
          border: `3px solid ${C.borderStrong}`,
          boxShadow: "0 40px 120px rgba(255,74,200,0.45)",
          transform: `translateY(${interpolate(s, [0, 1], [500, 0]) + float * (app.demo ? 0.3 : 1)}px) rotate(${interpolate(s, [0, 1], [8, app.demo ? 0 : -3])}deg)`,
        }}
      >
        {app.video ? (
          <OffthreadVideo
            src={staticFile(app.video)}
            startFrom={app.videoFrom ?? 0}
            volume={app.volume ?? 0.15}
            playbackRate={app.rate ?? 1}
            style={{ width: "100%", height: "100%", objectFit: app.demo ? "contain" : "cover", borderRadius: 56, background: "#000" }}
          />
        ) : (
          <Img src={staticFile(`brand/${app.screen}`)} style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 56 }} />
        )}
      </div>
      {!app.demo && <div style={{ position: "absolute", left: 640, top: 1320, width: 440, height: 660, transform: `translateY(${interpolate(s, [0, 1], [300, 0])}px)` }}>
        <Img src={staticFile(tl.interviewer.image)} style={{ width: "100%", height: "100%", objectFit: "contain" }} />
      </div>}
      {app.badge && !app.demo && (
        <div style={{ position: "absolute", top: 1480, left: 50, ...(cont ? {} : badgePop) }}>
          <Badge tag="FITUR" text={app.badge} />
        </div>
      )}
      {!cont && <Sfx name="whoosh" volume={0.4} />}
      {!cont && <Sfx name="ding" at={12} volume={0.35} />}
    </AbsoluteFill>
  );
};

// ------------------------------------------------------------------ CTA

export const CtaScene: React.FC<SceneProps> = ({ beat, tl }) => {
  const frame = useCurrentFrame();
  const cta = beat.cta!;
  const t0 = beat.speechFrames * 0.2;
  const typed = Math.floor(interpolate(frame, [t0, t0 + cta.word.length * 3], [0, cta.word.length], clamp));
  const sheet = usePop(t0 - 6, 0.85);
  const heart = interpolate(frame, [beat.speechFrames * 0.6, beat.speechFrames * 0.6 + 6], [0, 1], clamp);
  return (
    <AbsoluteFill>
      <Bg glow={1.3} />
      <div style={{ position: "absolute", top: 330, left: 60, right: 60 }}>
        <Caption text={`Komen *${cta.word}*`} speechFrames={Math.min(16, beat.speechFrames)} size={118} />
      </div>
      <div style={{ position: "absolute", top: 640, left: 90, right: 90, background: C.bgElev, border: `2px solid ${C.borderStrong}`, borderRadius: 36, padding: "30px 34px", boxShadow: "0 30px 80px rgba(155,77,255,0.35)", ...sheet }}>
        <div style={{ width: 70, height: 7, background: "rgba(255,255,255,0.2)", borderRadius: 4, margin: "0 auto 18px" }} />
        <div style={{ color: C.text, textAlign: "center", fontFamily: HEAD, fontSize: 32, fontWeight: 800, marginBottom: 26 }}>Komentar</div>
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <YouAvatar size={84} />
          <div style={{ flex: 1, fontFamily: HEAD }}>
            <div style={{ color: C.dim, fontSize: 24, fontWeight: 600 }}>kamu · baru saja</div>
            <div style={{ fontSize: 56, fontWeight: 900, minHeight: 66 }}>
              <GradText grad={GRAD_TRI}>{cta.word.slice(0, typed)}</GradText>
              <span style={{ color: C.text }}>{typed < cta.word.length && frame % 16 < 8 ? "|" : ""}</span>
            </div>
          </div>
          <div style={{ fontSize: 56, color: C.magenta, opacity: heart, transform: `scale(${0.5 + heart * 0.6})` }}>♥</div>
        </div>
      </div>
      {cta.line && (
        <div style={{ position: "absolute", top: 1060, left: 90, right: 90 }}>
          <Caption text={cta.line} speechFrames={beat.speechFrames} size={56} />
        </div>
      )}
      <div style={{ position: "absolute", left: 300, top: 1360, width: 480, height: 720 }}>
        <Img src={staticFile(tl.interviewer.image)} style={{ width: "100%", height: "100%", objectFit: "contain" }} />
      </div>
      <Sfx name="pop" at={t0} volume={0.4} />
    </AbsoluteFill>
  );
};

// ------------------------------------------------------------------ END
// Convopartner end card.

export const EndScene: React.FC<SceneProps> = ({ beat, tl }) => {
  const end = beat.end!;
  const a = usePop(0, 0.6);
  const b = usePop(8, 0.8);
  const c = usePop(16, 0.8);
  return (
    <AbsoluteFill>
      <Bg glow={1.8} />
      <div style={{ position: "absolute", top: 380, left: 0, right: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 30, fontFamily: HEAD }}>
        <Img src={staticFile("brand/logo.png")} style={{ width: 210, height: 210, ...a }} />
        <div style={{ ...a, color: C.text, fontSize: 96, fontWeight: 800, letterSpacing: -1 }}>ConvoPartner</div>
        <div style={{ ...b, padding: "0 90px" }}>
          <Caption text={end.headline} speechFrames={beat.speechFrames} size={60} />
        </div>
        {end.sub && <div style={{ ...b, color: C.muted, fontFamily: BODY, fontSize: 38, fontWeight: 600, textAlign: "center", padding: "0 110px", lineHeight: 1.35 }}>{end.sub}</div>}
        {end.cta && (
          <div style={{ ...c, marginTop: 24, background: GRAD_TRI, color: "#fff", fontSize: 46, fontWeight: 800, padding: "24px 54px", borderRadius: 999, boxShadow: "0 20px 60px rgba(255,74,200,0.45)" }}>{end.cta}</div>
        )}
        <div style={{ ...c, color: C.dim, fontSize: 34, fontWeight: 700 }}>convopartner.com</div>
      </div>
      {tl.disclaimer && (
        <div style={{ position: "absolute", bottom: 330, left: 0, right: 0, textAlign: "center", color: C.dim, fontFamily: BODY, fontSize: 26, fontWeight: 600 }}>{tl.disclaimer}</div>
      )}
      <Sfx name="ding" volume={0.45} />
    </AbsoluteFill>
  );
};

// ------------------------------------------------------------------ HOOK SWAP
// "Bagaimana jika X dihapus?": an answer sheet gets crossed out, then the replacement pops in.
const SwapArt: React.FC<{ swap: NonNullable<Beat["swap"]>; speechFrames: number }> = ({ swap, speechFrames }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const tc = Math.round(speechFrames * 0.4);
  const tm = Math.round(speechFrames * 0.62);
  const cross = interpolate(frame, [tc, tc + 6], [0, 1], clamp);
  const gone = interpolate(frame, [tm - 6, tm + 4], [0, 1], clamp);
  const mic = spring({ frame: frame - tm, fps, config: { damping: 11, stiffness: 160 } });
  const filled = (r: number, c: number) => (r * 7 + c * 3) % 5 === 0;
  return (
    <div style={{ position: "absolute", top: 1210, left: 0, right: 0, height: 420, display: "flex", justifyContent: "center", alignItems: "center" }}>
      {swap.kind === "mask" ? (
        <div style={{ position: "absolute", transform: `rotate(${gone * 25}deg) scale(${1 - gone * 0.4}) translateY(${gone * 200}px)`, opacity: 1 - gone }}>
          <div style={{ width: 360, height: 430, borderRadius: "48% 48% 46% 46% / 40% 40% 60% 60%", background: "#F7F3EC", boxShadow: "0 30px 80px rgba(0,0,0,0.55), inset 0 -20px 40px rgba(0,0,0,0.12)", position: "relative", display: "flex", flexDirection: "column", alignItems: "center" }}>
            <div style={{ display: "flex", gap: 90, marginTop: 150 }}>
              {[0, 1].map((i) => (
                <div key={i} style={{ width: 70, height: 30, borderTop: "10px solid #1B1F3A", borderRadius: "50% 50% 0 0" }} />
              ))}
            </div>
            <div style={{ width: 150, height: 60, marginTop: 50, borderBottom: "12px solid #C2304A", borderRadius: "0 0 90px 90px" }} />
            <div style={{ position: "absolute", top: 230, left: 50, width: 60, height: 30, borderRadius: "50%", background: "rgba(255,120,140,0.35)" }} />
            <div style={{ position: "absolute", top: 230, right: 50, width: 60, height: 30, borderRadius: "50%", background: "rgba(255,120,140,0.35)" }} />
            <svg width={360} height={430} style={{ position: "absolute", inset: 0 }}>
              <polyline points="180,0 160,90 200,150 150,240 190,300 170,430" fill="none" stroke="#1B1F3A" strokeWidth={8} strokeDasharray={600} strokeDashoffset={600 * (1 - cross)} />
              <polyline points="200,150 280,190 330,170" fill="none" stroke="#1B1F3A" strokeWidth={6} strokeDasharray={200} strokeDashoffset={200 * (1 - cross)} />
            </svg>
          </div>
          <div style={{ textAlign: "center", marginTop: 16, fontFamily: HEAD, fontSize: 44, fontWeight: 900, color: C.text, textShadow: "0 4px 20px #050816" }}>{swap.from}</div>
        </div>
      ) : (
      <div
        style={{
          position: "absolute",
          width: 560,
          padding: "26px 34px 30px",
          borderRadius: 26,
          background: "#F3F0FF",
          boxShadow: "0 30px 80px rgba(0,0,0,0.5)",
          transform: `rotate(${-4 - gone * 18}deg) scale(${1 - gone * 0.5}) translateY(${gone * 160}px)`,
          opacity: 1 - gone,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", fontFamily: HEAD, color: "#1B1F3A" }}>
          <span style={{ fontSize: 64, fontWeight: 900 }}>{swap.from}</span>
          <span style={{ fontSize: 26, fontWeight: 700, opacity: 0.6 }}>解答用紙</span>
        </div>
        {[0, 1, 2, 3].map((r) => (
          <div key={r} style={{ display: "flex", gap: 18, marginTop: 16, alignItems: "center" }}>
            <span style={{ fontFamily: HEAD, fontSize: 24, fontWeight: 800, color: "#1B1F3A", width: 30 }}>{r + 1}</span>
            {[0, 1, 2, 3, 4, 5, 6].map((c) => (
              <div key={c} style={{ width: 36, height: 36, borderRadius: "50%", border: "3px solid #1B1F3A", background: filled(r, c) ? "#1B1F3A" : "transparent" }} />
            ))}
          </div>
        ))}
        {[45, -45].map((deg) => (
          <div
            key={deg}
            style={{
              position: "absolute",
              left: "50%",
              top: "50%",
              width: 640,
              height: 26,
              marginLeft: -320,
              marginTop: -13,
              borderRadius: 13,
              background: C.red,
              boxShadow: `0 0 30px ${C.red}`,
              transform: `rotate(${deg}deg) scaleX(${cross})`,
            }}
          />
        ))}
      </div>
      )}
      {frame >= tm && (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 20, transform: `scale(${mic})` }}>
          <div style={{ width: 230, height: 230, borderRadius: "50%", background: GRAD_TRI, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 130, boxShadow: "0 0 90px rgba(255,74,200,0.6)" }}>
            {swap.icon ?? "🎙️"}
          </div>
          <div style={{ fontFamily: HEAD, fontSize: 58, fontWeight: 900, color: C.text, textShadow: "0 4px 20px #050816" }}>{swap.to}</div>
        </div>
      )}
      <Sfx name="buzz" at={tc} volume={0.4} />
      <Sfx name="pop" at={tm} volume={0.5} />
    </div>
  );
};

// ------------------------------------------------------------------ DUEL (story)
// Two people side by side; focus, bubbles, a "who wins?" question, a stamp and a level climb play across beats.

const DuelCard: React.FC<{ side: DuelSide; hue: string; enter: number; dir: number; dim: number; glow: number }> = ({ side, hue, enter, dir, dim, glow }) => (
  <div
    style={{
      position: "relative",
      width: 470,
      height: 560,
      borderRadius: 40,
      padding: "40px 30px",
      background: "linear-gradient(170deg, #1B2142, #0A0E22)",
      border: `4px solid ${glow > 0.5 ? hue : C.border}`,
      boxShadow: `0 0 ${80 * glow}px ${hue}`,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: 18,
      opacity: interpolate(enter, [0, 0.4], [0, 1], clamp) * (1 - dim * 0.6),
      transform: `translateX(${(1 - enter) * dir * 500}px) scale(${1 - dim * 0.06 + glow * 0.03})`,
    }}
  >
    <div style={{ width: 150, height: 150, borderRadius: "50%", background: hue, color: "#fff", fontFamily: HEAD, fontSize: 76, fontWeight: 900, display: "flex", alignItems: "center", justifyContent: "center" }}>
      {side.name[0]}
    </div>
    <div style={{ fontFamily: HEAD, fontSize: 58, fontWeight: 900, color: C.text }}>{side.name}</div>
    <div style={{ background: C.gold, color: C.bg, fontFamily: HEAD, fontSize: 48, fontWeight: 900, padding: "4px 28px", borderRadius: 16 }}>{side.tag}</div>
    <div style={{ fontFamily: BODY, fontSize: 36, fontWeight: 700, color: C.muted, textAlign: "center", lineHeight: 1.25 }}>{side.trait}</div>
    {side.video && (
      <div style={{ position: "absolute", top: -60, right: -26, width: 170, height: 360, borderRadius: 28, padding: 7, background: "#1B1F3A", border: `3px solid ${C.borderStrong}`, transform: "rotate(6deg)", boxShadow: "0 20px 60px rgba(255,74,200,0.5)" }}>
        <OffthreadVideo src={staticFile(side.video)} volume={0.12} style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 22 }} />
      </div>
    )}
  </div>
);

const CardDuel: React.FC<SceneProps> = ({ beat, prev, tl }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const d = beat.duel!;
  const pd = prev?.scene === "duel" ? prev.duel : undefined;
  const fresh = !pd;
  const enter = fresh ? spring({ frame, fps, config: { damping: 15, stiffness: 110 } }) : 1;
  const e = interpolate(frame, [0, 8], [0, 1], clamp); // ease from the previous beat's state
  const level = (dd: typeof d | undefined, side: "left" | "right") => {
    if (!dd) return { dim: 0, glow: 0 };
    if (dd.ask) return { dim: 0.6, glow: 0 };
    if (dd.stamp) return dd.stamp.side === side ? { dim: 0, glow: 1 } : { dim: 1, glow: 0 };
    if (dd.climb) return dd.climb.side === side ? { dim: 0, glow: 1 } : { dim: 1, glow: 0 };
    if (!dd.focus || dd.focus === "both") return { dim: 0, glow: 0 };
    return dd.focus === side ? { dim: 0, glow: 1 } : { dim: 1, glow: 0 };
  };
  const mix = (side: "left" | "right") => {
    const a = level(pd, side);
    const b = level(d, side);
    return { dim: a.dim + (b.dim - a.dim) * e, glow: a.glow + (b.glow - a.glow) * e };
  };
  const L = mix("left");
  const R = mix("right");
  const askPop = spring({ frame: frame - 2, fps, config: { damping: 9, stiffness: 140 } });
  const stampFresh = !!d.stamp && pd?.stamp?.text !== d.stamp.text;
  const laterPop = usePop(0, 0.6);
  const climbAt = (i: number, n: number) => Math.round(((i + 0.6) / (n + 0.6)) * beat.speechFrames * 0.85);
  return (
    <AbsoluteFill>
      <Bg glow={1.1} />
      <div style={{ position: "absolute", top: 160, left: 0, right: 0, display: "flex", justifyContent: "center" }}>
        {d.later ? (
          <div style={{ background: GRAD, color: "#fff", fontFamily: HEAD, fontSize: 44, fontWeight: 900, padding: "10px 36px", borderRadius: 999, ...(pd?.later === d.later ? {} : laterPop) }}>
            ⏩ {d.later}
          </div>
        ) : d.label ? (
          <div style={{ border: `2px solid ${C.borderStrong}`, color: C.dim, fontFamily: HEAD, fontSize: 26, fontWeight: 800, letterSpacing: 3, padding: "6px 22px", borderRadius: 999 }}>
            {d.label.toUpperCase()}
          </div>
        ) : null}
      </div>
      <div
        style={{
          position: "absolute",
          top: 240,
          left: 30,
          right: 30,
          padding: "20px 30px 30px",
          borderRadius: 40,
          background: "radial-gradient(ellipse at 50% 45%, rgba(5,8,22,0.8) 0%, rgba(5,8,22,0.5) 60%, rgba(5,8,22,0) 80%)",
        }}
      >
        <Caption text={captionOf(beat)} speechFrames={beat.speechFrames} size={62} />
      </div>
      <div style={{ position: "absolute", top: 580, left: 45, right: 45, display: "flex", justifyContent: "space-between" }}>
        <DuelCard side={d.left} hue={C.purple} enter={enter} dir={-1} dim={L.dim} glow={L.glow} />
        <DuelCard side={d.right} hue={C.orange} enter={enter} dir={1} dim={R.dim} glow={R.glow} />
      </div>
      {d.bubbles &&
        (["left", "right"] as const).map((side) =>
          d.bubbles?.[side] ? (
            <div
              key={side}
              style={{
                position: "absolute",
                top: 1170,
                [side]: 45,
                width: 470,
                padding: "20px 26px",
                borderRadius: side === "left" ? "8px 30px 30px 30px" : "30px 8px 30px 30px",
                background: side === "left" ? C.bgElev2 : GRAD,
                border: side === "left" ? `2px solid ${C.border}` : "none",
                ...(side === "right" ? {} : {}),
              }}
            >
              <Caption text={(() => { const b = d.bubbles![side]!; return typeof b === "string" ? b : b.text; })()} speechFrames={beat.speechFrames} size={40} align="left" />
            </div>
          ) : null,
        )}
      {d.ask && (
        <div style={{ position: "absolute", top: 620, left: 0, right: 0, display: "flex", justifyContent: "center", transform: `scale(${askPop})` }}>
          <div style={{ fontFamily: HEAD, fontSize: 420, fontWeight: 900, lineHeight: 1, filter: "drop-shadow(0 0 60px rgba(255,74,200,0.7))" }}>
            <GradText grad={GRAD_TRI}>?</GradText>
          </div>
        </div>
      )}
      {d.stamp && (
        <div style={{ position: "absolute", top: 820, width: 560, [d.stamp.side]: d.stamp.side === "left" ? 0 : 0, display: "flex", justifyContent: "center", transform: "scale(0.62)" }}>
          <Sequence from={stampFresh ? 3 : 0} layout="none">
            <Stamp text={d.stamp.text} color={d.stamp.color === "red" ? C.red : C.green} fresh={stampFresh} />
          </Sequence>
        </div>
      )}
      {d.climb && (
        <div style={{ position: "absolute", top: 1160, [d.climb.side]: 45, width: 470, height: 260 }}>
          {d.climb.steps.map((st, i) => {
            const at = climbAt(i, d.climb!.steps.length);
            const k = interpolate(frame, [at, at + 7], [0, 1], clamp);
            const n = d.climb!.steps.length;
            return (
              <div
                key={i}
                style={{
                  position: "absolute",
                  left: i * (470 / n),
                  bottom: i * 56,
                  width: 470 / n - 12,
                  padding: "12px 0",
                  textAlign: "center",
                  borderRadius: 18,
                  background: i === n - 1 ? C.green : C.bgElev2,
                  color: i === n - 1 ? C.bg : C.text,
                  border: `2px solid ${i === n - 1 ? C.green : C.borderStrong}`,
                  fontFamily: HEAD,
                  fontSize: 38,
                  fontWeight: 900,
                  opacity: k,
                  transform: `translateY(${(1 - k) * 40}px)`,
                }}
              >
                {st}
              </div>
            );
          })}
          {d.climb.note && (
            <div
              style={{
                position: "absolute",
                left: 0,
                top: -10,
                fontFamily: HEAD,
                fontSize: 40,
                fontWeight: 900,
                color: C.green,
                opacity: interpolate(frame, [beat.speechFrames * 0.8, beat.speechFrames * 0.8 + 8], [0, 1], clamp),
              }}
            >
              {d.climb.note}
            </div>
          )}
          {d.climb.steps.map((_, i) => (
            <Sfx key={i} name="pop" at={climbAt(i, d.climb!.steps.length)} volume={0.35} />
          ))}
          <Sfx name="ding" at={Math.round(beat.speechFrames * 0.8)} volume={0.4} />
        </div>
      )}
      <div style={{ position: "absolute", bottom: 330, left: 0, right: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 20 }}>
        <Wave src={beat.audio} height={60} />
        <NameTag tl={tl} />
      </div>
      {fresh && <Sfx name="whoosh" volume={0.45} />}
      {d.ask && pd?.ask !== true && <Sfx name="impact" at={2} volume={0.5} />}
      {stampFresh && <Sfx name={d.stamp!.color === "red" ? "buzz" : "ding"} at={3} volume={0.5} />}
      {stampFresh && <Sfx name="impact" at={3} volume={0.55} />}
      {d.later && pd?.later !== d.later && <Sfx name="whoosh" volume={0.45} />}
    </AbsoluteFill>
  );
};

// ------------------------------------------------------------------ story motion (camera, grade, particles)

type Duel = NonNullable<Beat["duel"]>;
type CamPos = { s: number; x: number };
const CAMS: Record<NonNullable<Duel["cam"]> | "none", CamPos> = {
  none: { s: 1, x: 0 },
  push: { s: 1.1, x: 0 },
  close: { s: 1.24, x: 0 },
  pull: { s: 1, x: 0 }, // starts from "close" when coming from a neutral shot
  left: { s: 1.07, x: 80 },
  right: { s: 1.07, x: -80 },
};
const camOf = (d?: Duel) => CAMS[d?.cam ?? "none"];

const MOODS: Record<NonNullable<Duel["mood"]>, string> = {
  night: "linear-gradient(180deg, rgba(8,14,60,0.55), rgba(10,10,40,0.35))",
  dusk: "linear-gradient(180deg, rgba(255,110,60,0.28), rgba(120,40,120,0.22))",
  warm: "linear-gradient(180deg, rgba(255,170,80,0.2), rgba(255,120,60,0.12))",
  dark: "rgba(0,0,0,0.45)",
};

// Particles in front of the background; positions are seeded so every render is identical.
const Fx: React.FC<{ kind: NonNullable<Duel["fx"]>; t: number }> = ({ kind, t }) => {
  if (kind === "rain")
    return (
      <AbsoluteFill style={{ pointerEvents: "none" }}>
        {Array.from({ length: 70 }, (_, i) => {
          const sp = 40 + random(`r${i}`) * 25;
          const y = ((t * sp + random(`ry${i}`) * 2400) % 2400) - 300;
          return <div key={i} style={{ position: "absolute", left: random(`rx${i}`) * 1180 - 50, top: y, width: 3, height: 70, background: "rgba(200,220,255,0.35)", transform: "rotate(12deg)" }} />;
        })}
      </AbsoluteFill>
    );
  if (kind === "steam")
    return (
      <AbsoluteFill style={{ pointerEvents: "none" }}>
        {Array.from({ length: 10 }, (_, i) => {
          const k = ((t + random(`s${i}`) * 90) % 90) / 90;
          return (
            <div key={i} style={{ position: "absolute", left: 300 + random(`sx${i}`) * 480 + Math.sin(t / 15 + i) * 30, top: 1500 - k * 600, width: 220, height: 220, borderRadius: "50%", background: "radial-gradient(circle, rgba(255,255,255,0.35), rgba(255,255,255,0) 70%)", opacity: Math.sin(k * Math.PI), transform: `scale(${0.6 + k})` }} />
          );
        })}
      </AbsoluteFill>
    );
  const sparkle = kind === "sparkle";
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {Array.from({ length: sparkle ? 26 : 40 }, (_, i) => {
        const r = random(`d${i}`);
        const x = random(`dx${i}`) * 1080 + Math.sin(t / 40 + i) * 20;
        const y = sparkle ? 300 + random(`dy${i}`) * 1100 : (((random(`dy${i}`) * 1920 - t * (0.4 + r)) % 1920) + 1920) % 1920;
        const tw = 0.5 + 0.5 * Math.sin(t / (sparkle ? 6 : 14) + i * 1.7);
        return sparkle ? (
          <div key={i} style={{ position: "absolute", left: x, top: y, fontSize: 18 + r * 26, color: "#FFE7A8", opacity: tw * 0.9, textShadow: "0 0 12px #FFD36A" }}>✦</div>
        ) : (
          <div key={i} style={{ position: "absolute", left: x, top: y, width: 3 + r * 6, height: 3 + r * 6, borderRadius: "50%", background: "rgba(255,230,190,0.8)", opacity: 0.2 + tw * 0.45, filter: "blur(1px)" }} />
        );
      })}
    </AbsoluteFill>
  );
};

// Story version of the duel: real characters over a background (bg crossfades when it changes).
const StoryDuel: React.FC<SceneProps> = ({ beat, prev, tl }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const abs = beat.from + frame; // continuous motion across beats of the same scene
  const d = beat.duel!;
  const pd = prev?.scene === "duel" ? prev.duel : undefined;
  const fresh = !pd;
  const e = interpolate(frame, [0, 8], [0, 1], clamp);
  const bgIn = pd?.bg && pd.bg !== d.bg ? interpolate(frame, [0, 12], [0, 1], clamp) : 1;
  const enter = fresh ? spring({ frame, fps, config: { damping: 15, stiffness: 100 } }) : 1;
  const soloIn = d.solo && pd?.solo !== d.solo ? spring({ frame, fps, config: { damping: 14, stiffness: 110 } }) : 1;
  const lit = (dd: typeof d | undefined, side: "left" | "right") => {
    if (!dd) return 1;
    if (dd.ask) return 0.55;
    const pick = dd.stamp?.side ?? dd.climb?.side ?? (dd.focus === "left" || dd.focus === "right" ? dd.focus : undefined);
    return !pick || pick === side ? 1 : 0.35;
  };
  const mix = (side: "left" | "right") => lit(pd, side) + (lit(d, side) - lit(pd, side)) * e;
  const askPop = spring({ frame: frame - 2, fps, config: { damping: 9, stiffness: 140 } });
  const stampFresh = !!d.stamp && pd?.stamp?.text !== d.stamp.text;
  const laterPop = usePop(0, 0.6);
  const climbAt = (i: number, n: number) => Math.round(((i + 0.6) / (n + 0.6)) * beat.speechFrames * 0.85);
  const hue = { left: C.purple, right: C.orange };
  // camera eases from where the previous beat left it to this beat's framing; bg moves less (parallax)
  const camFrom = pd ? camOf(pd) : d.cam === "pull" ? CAMS.close : CAMS.none;
  const camTo = d.cam === "pull" && !pd?.cam ? CAMS.none : camOf(d);
  const ck = interpolate(frame, [0, beat.frames], [0, 1], { ...clamp, easing: Easing.inOut(Easing.cubic) });
  const cam = { s: camFrom.s + (camTo.s - camFrom.s) * ck, x: camFrom.x + (camTo.x - camFrom.x) * ck };
  const shakeK = d.shake ? Math.max(0, 1 - frame / 14) : 0;
  const shakeX = Math.sin(frame * 2.3) * 22 * shakeK;
  const shakeY = Math.cos(frame * 3.1) * 14 * shakeK;
  const world = `translate(${cam.x + shakeX}px, ${shakeY}px) scale(${cam.s})`;
  const bgCam = `translate(${cam.x * 0.4 + shakeX * 0.5}px, ${shakeY * 0.5}px) scale(${(1 + (cam.s - 1) * 0.5) * (1.06 + abs * 0.0002)})`;
  const reactOf = (side: "left" | "right") => {
    const r = d.react?.side === side ? d.react.kind : undefined;
    if (r === "jump") return { y: -Math.abs(Math.sin(Math.min(frame / 16, 1) * Math.PI * 2)) * 70 * (1 - Math.min(frame / 16, 1) * 0.4), x: 0, s: 1 };
    if (r === "shrink") { const k = interpolate(frame, [0, 12], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) }); return { y: 30 * k, x: 0, s: 1 - 0.05 * k }; }
    if (r === "nod") return { y: frame < 28 ? Math.max(0, Math.sin(frame / 4.5)) * 20 : 0, x: 0, s: 1 };
    if (r === "shiver") return { y: 0, x: Math.sin(frame * 2.8) * 5, s: 1 };
    return { y: 0, x: 0, s: 1 };
  };

  const person = (side: "left" | "right") => {
    const p = d[side];
    if (!p.image || (d.solo && d.solo !== side)) return null;
    const k = mix(side);
    const solo = d.solo === side;
    const talking = beat.line?.side === side ? frame >= beat.line.at && frame < beat.line.at + beat.line.frames : !!d.bubbles?.[side];
    const nervous = talking && side === "left" ? Math.sin(abs * 1.7) * 2.5 : 0;
    const bob = talking && side === "right" ? Math.abs(Math.sin(abs / 4)) * -8 : 0;
    const breathe = 1 + Math.sin(abs / 20 + (side === "left" ? 0 : 1.7)) * 0.008;
    const x = solo ? 330 : side === "left" ? -120 : 428;
    const dir = side === "left" ? -1 : 1;
    const inK = solo ? soloIn : enter;
    const walk = -Math.abs(Math.sin(inK * Math.PI * 3)) * 34 * (1 - inK); // steps while walking in
    const rx = reactOf(side);
    return (
      <div
        key={side}
        style={{
          position: "absolute",
          left: x,
          top: 690,
          width: 772,
          height: 1150,
          opacity: interpolate(inK, [0, 0.4], [0, 1], clamp),
          transform: `translateX(${(1 - inK) * dir * 300 + nervous + rx.x}px) translateY(${bob + walk + rx.y}px) scale(${breathe * (0.97 + k * 0.03) * rx.s})`,
          transformOrigin: "50% 100%",
          filter: `brightness(${0.35 + k * 0.65}) saturate(${0.5 + k * 0.5}) drop-shadow(0 0 ${k > 0.9 && lit(d, side) === 1 && (d.focus === side || d.stamp?.side === side || d.climb?.side === side) ? 40 : 0}px ${hue[side]})`,
        }}
      >
        {RIGS[p.image] ? (
          <Puppet image={p.image} width={772} seed={`${p.name}-${side}`} sway={false} gesture={talking ? 1 : d.focus === side || d.react?.side === side ? 0.6 : 0.25} />
        ) : (
          <Img src={staticFile(p.image)} style={{ width: "100%", height: "100%", objectFit: "contain" }} />
        )}
        <div style={{ position: "absolute", top: -78, left: 0, right: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, background: "rgba(5,8,22,0.85)", border: `3px solid ${hue[side]}`, borderRadius: 999, padding: p.tag ? "6px 10px 6px 26px" : "6px 26px" }}>
            <span style={{ fontFamily: HEAD, fontSize: 40, fontWeight: 900, color: C.text }}>{p.name}</span>
            {p.tag && <span style={{ background: C.gold, color: C.bg, fontFamily: HEAD, fontSize: 34, fontWeight: 900, padding: "0 16px", borderRadius: 999 }}>{p.tag}</span>}
          </div>
          <span style={{ fontFamily: BODY, fontSize: 28, fontWeight: 700, color: C.text, textShadow: "0 2px 10px #050816, 0 0 4px #050816" }}>{p.trait}</span>
        </div>
      </div>
    );
  };
  const phone = (["left", "right"] as const).find((sd) => d[sd].video);
  const bubPop = usePop(2, 0.6);
  const linePop = usePop(beat.line?.at ?? 0, 0.6); // a spoken bubble pops in when the character starts talking
  const bub = (side: "left" | "right") => {
    const b = d.bubbles?.[side];
    return typeof b === "string" ? { text: b, sub: undefined, tone: undefined } : { text: b?.text ?? "", sub: b?.sub, tone: b?.tone };
  };

  return (
    <AbsoluteFill style={{ background: C.bg }}>
      <AbsoluteFill style={{ transform: bgCam, transformOrigin: "50% 48%" }}>
        {pd?.bg && pd.bg !== d.bg && <Img src={staticFile(pd.bg)} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />}
        {d.bg && <Img src={staticFile(d.bg)} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", opacity: bgIn, filter: bgIn < 1 ? `blur(${(1 - bgIn) * 14}px)` : undefined }} />}
      </AbsoluteFill>
      {pd?.mood && pd.mood !== d.mood && <AbsoluteFill style={{ background: MOODS[pd.mood], opacity: 1 - e }} />}
      {d.mood && <AbsoluteFill style={{ background: MOODS[d.mood], opacity: pd?.mood === d.mood ? 1 : e }} />}
      {d.fx && <Fx kind={d.fx} t={abs} />}
      <AbsoluteFill style={{ background: "linear-gradient(180deg, rgba(5,8,22,0.9) 0%, rgba(5,8,22,0.55) 32%, rgba(5,8,22,0.15) 55%, rgba(5,8,22,0.55) 100%)" }} />
      <AbsoluteFill style={{ transform: world, transformOrigin: "50% 48%" }}>
        {person("left")}
        {person("right")}
      </AbsoluteFill>
      {cam.s > 1.08 && <AbsoluteFill style={{ background: "radial-gradient(ellipse at 50% 45%, rgba(0,0,0,0) 55%, rgba(0,0,0,0.55) 100%)", opacity: interpolate(cam.s, [1.08, 1.2], [0, 1], clamp) }} />}
      <BottomFade from={1450} />
      <div style={{ position: "absolute", top: 160, left: 0, right: 0, display: "flex", justifyContent: "center" }}>
        {d.later ? (
          <div style={{ background: GRAD, color: "#fff", fontFamily: HEAD, fontSize: 44, fontWeight: 900, padding: "10px 36px", borderRadius: 999, ...(pd?.later === d.later ? {} : laterPop) }}>
            ⏩ {d.later}
          </div>
        ) : d.label ? (
          <div style={{ background: "rgba(5,8,22,0.6)", border: `2px solid ${C.borderStrong}`, color: C.muted, fontFamily: HEAD, fontSize: 26, fontWeight: 800, letterSpacing: 3, padding: "6px 22px", borderRadius: 999 }}>
            {d.label.toUpperCase()}
          </div>
        ) : null}
      </div>
      <div style={{ position: "absolute", top: 240, left: 40, right: 40 }}>
        <Caption text={captionOf(beat)} speechFrames={beat.speechFrames} size={62} />
      </div>
      {d.thought && (
        <div style={{ position: "absolute", top: 415, left: (d.solo === d.thought.side ? 716 : d.thought.side === "left" ? 266 : 814) - 300, width: 600, display: "flex", justifyContent: "center" }}>
          <ThoughtCloud text={d.thought.text} fresh={pd?.thought?.text !== d.thought.text} />
          {pd?.thought?.text !== d.thought.text && <Sfx name="pop" volume={0.45} />}
        </div>
      )}
      {d.screen && (
        <div style={{ position: "absolute", top: 470, left: (d.solo === d.screen.side ? 716 : d.screen.side === "left" ? 330 : 750) - 300, width: 600, display: "flex", justifyContent: "center" }}>
          <ErrorScreen {...d.screen} fresh={JSON.stringify(pd?.screen) !== JSON.stringify(d.screen)} />
          {JSON.stringify(pd?.screen) !== JSON.stringify(d.screen) && <Sfx name={d.screen.tone === "green" ? "ding" : "buzz"} volume={0.45} />}
        </div>
      )}
      {d.fine && <FineCounter fine={d.fine} start={d.fine.from ?? pd?.fine?.to ?? 0} speechFrames={beat.speechFrames} />}
      {phone && (
        <div style={{ position: "absolute", left: 430, top: 860, width: 190, height: 400, borderRadius: 30, padding: 8, background: "#1B1F3A", border: `3px solid ${C.borderStrong}`, transform: `rotate(-6deg) scale(${enter})`, boxShadow: "0 20px 60px rgba(255,74,200,0.55)" }}>
          <OffthreadVideo src={staticFile(d[phone].video!)} volume={0.12} style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 22 }} />
        </div>
      )}
      {d.bubbles &&
        (["left", "right"] as const).map((side) =>
          d.bubbles?.[side] ? (
            <div
              key={side}
              style={{
                position: "absolute",
                top: 1010,
                [side]: 40,
                width: 450,
                padding: "20px 26px",
                borderRadius: side === "left" ? "8px 30px 30px 30px" : "30px 8px 30px 30px",
                background: bub(side).tone === "red" ? "rgba(255,77,109,0.95)" : side === "left" ? "rgba(20,24,50,0.94)" : GRAD,
                border: side === "left" && bub(side).tone !== "red" ? `2px solid ${C.borderStrong}` : "none",
                boxShadow: bub(side).tone === "red" ? `0 0 50px ${C.red}` : "0 16px 40px rgba(0,0,0,0.5)",
                ...(beat.line?.side === side ? linePop : pd?.bubbles?.[side] && JSON.stringify(pd.bubbles[side]) === JSON.stringify(d.bubbles?.[side]) ? {} : bubPop),
              }}
            >
              <Caption text={bub(side).text} speechFrames={beat.speechFrames} size={42} align="left" instant={!!bub(side).sub} />
              {bub(side).sub && <div style={{ marginTop: 10, fontFamily: BODY, fontSize: 32, fontWeight: 700, color: "rgba(255,255,255,0.85)" }}>{bub(side).sub}</div>}
            </div>
          ) : null,
        )}
      {d.ask && (
        <div style={{ position: "absolute", top: 640, left: 0, right: 0, display: "flex", justifyContent: "center", transform: `scale(${askPop})` }}>
          <div style={{ fontFamily: HEAD, fontSize: 420, fontWeight: 900, lineHeight: 1, filter: "drop-shadow(0 0 60px rgba(255,74,200,0.8))" }}>
            <GradText grad={GRAD_TRI}>?</GradText>
          </div>
        </div>
      )}
      {d.stamp && (
        <div style={{ position: "absolute", top: 1040, width: 560, [d.stamp.side]: 0, display: "flex", justifyContent: "center", transform: "scale(0.7)" }}>
          <Sequence from={stampFresh ? 3 : 0} layout="none">
            <Stamp text={d.stamp.text} color={d.stamp.color === "red" ? C.red : C.green} fresh={stampFresh} />
          </Sequence>
        </div>
      )}
      {d.climb && (
        <div style={{ position: "absolute", top: 1000, left: 50, width: 420, height: 300 }}>
          {d.climb.steps.map((st, i) => {
            const n = d.climb!.steps.length;
            const at = climbAt(i, n);
            const k = interpolate(frame, [at, at + 7], [0, 1], clamp);
            return (
              <div
                key={i}
                style={{
                  position: "absolute",
                  left: i * (420 / n),
                  bottom: i * 64,
                  width: 420 / n - 12,
                  padding: "14px 0",
                  textAlign: "center",
                  borderRadius: 18,
                  background: i === n - 1 ? C.green : "rgba(20,24,50,0.94)",
                  color: i === n - 1 ? C.bg : C.text,
                  border: `2px solid ${i === n - 1 ? C.green : C.borderStrong}`,
                  fontFamily: HEAD,
                  fontSize: 40,
                  fontWeight: 900,
                  opacity: k,
                  transform: `translateY(${(1 - k) * 40}px)`,
                }}
              >
                {st}
              </div>
            );
          })}
          {d.climb.note && (
            <div style={{ position: "absolute", left: 0, top: -30, background: "rgba(5,8,22,0.8)", borderRadius: 16, padding: "6px 18px", fontFamily: HEAD, fontSize: 42, fontWeight: 900, color: C.green, opacity: interpolate(frame, [beat.speechFrames * 0.8, beat.speechFrames * 0.8 + 8], [0, 1], clamp) }}>
              {d.climb.note}
            </div>
          )}
          {d.climb.steps.map((_, i) => (
            <Sfx key={i} name="pop" at={climbAt(i, d.climb!.steps.length)} volume={0.35} />
          ))}
          <Sfx name="ding" at={Math.round(beat.speechFrames * 0.8)} volume={0.4} />
        </div>
      )}
      <div style={{ position: "absolute", bottom: 330, left: 0, right: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 20 }}>
        <Wave src={beat.audio} height={60} />
        <NameTag tl={tl} />
      </div>
      {fresh && <Sfx name="whoosh" volume={0.45} />}
      {d.ask && pd?.ask !== true && <Sfx name="impact" at={2} volume={0.5} />}
      {stampFresh && <Sfx name={d.stamp!.color === "red" ? "buzz" : "ding"} at={3} volume={0.5} />}
      {stampFresh && <Sfx name="impact" at={3} volume={0.55} />}
      {d.later && pd?.later !== d.later && <Sfx name="whoosh" volume={0.45} />}
      {pd && (["left", "right"] as const).some((sd) => pd[sd].image !== d[sd].image) && <Sfx name="impact" volume={0.5} />}
      {beat.line && (
        <Sequence from={beat.line.at} durationInFrames={beat.line.frames} layout="none">
          <Audio src={staticFile(beat.line.audio)} />
        </Sequence>
      )}
      {d.shake && (
        <>
          <AbsoluteFill style={{ background: "#fff", opacity: interpolate(frame, [0, 2, 9], [0, 0.5, 0], clamp) }} />
          <Sfx name="impact" volume={0.6} />
        </>
      )}
      {d.cut && d.later && pd?.later !== d.later && (
        <AbsoluteFill style={{ background: "#03040C", alignItems: "center", justifyContent: "center", opacity: interpolate(frame, [0, 14, 22], [1, 1, 0], clamp) }}>
          <div style={{ fontFamily: HEAD, fontSize: 96, fontWeight: 900, color: C.text, letterSpacing: 2, transform: `scale(${interpolate(frame, [0, 22], [0.92, 1.04], clamp)})` }}>{d.later}</div>
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  );
};

export const DuelScene: React.FC<SceneProps> = (props) =>
  props.beat.duel!.left.image || props.beat.duel!.right.image ? <StoryDuel {...props} /> : <CardDuel {...props} />;

// ------------------------------------------------------------------ DEBATE (comment CTA)
// Split screen: two camps, VS, Yui in the middle asking for opinions in the comments.

export const DebateScene: React.FC<SceneProps> = ({ beat, tl }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const db = beat.debate!;
  const l = spring({ frame, fps, config: { damping: 13, stiffness: 120 } });
  const r = spring({ frame: frame - 5, fps, config: { damping: 13, stiffness: 120 } });
  const vs = spring({ frame: frame - 12, fps, config: { damping: 8, stiffness: 180 } });
  const pulse = 1 + Math.sin(frame / 6) * 0.03;
  const camp = (c: { icon: string; label: string }, k: number, hue: string) => (
    <div style={{ width: 440, display: "flex", flexDirection: "column", alignItems: "center", gap: 22, transform: `scale(${k})`, opacity: k }}>
      <div style={{ width: 230, height: 230, borderRadius: "50%", background: hue, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 130, boxShadow: `0 0 80px ${hue}` }}>{c.icon}</div>
      <div style={{ fontFamily: HEAD, fontSize: 50, fontWeight: 900, color: C.text, textAlign: "center", lineHeight: 1.1, textShadow: "0 4px 20px #050816" }}>{c.label}</div>
    </div>
  );
  return (
    <AbsoluteFill>
      <Bg glow={0.6} />
      <AbsoluteFill style={{ background: "linear-gradient(100deg, rgba(155,77,255,0.35) 0%, rgba(155,77,255,0.08) 49.6%, rgba(255,155,74,0.08) 50.4%, rgba(255,155,74,0.32) 100%)" }} />
      <Host tl={tl} beat={beat} top={1060} />
      <BottomFade from={1500} />
      <div
        style={{
          position: "absolute",
          top: 170,
          left: 30,
          right: 30,
          padding: "20px 30px 30px",
          borderRadius: 40,
          background: "radial-gradient(ellipse at 50% 45%, rgba(5,8,22,0.8) 0%, rgba(5,8,22,0.5) 60%, rgba(5,8,22,0) 80%)",
        }}
      >
        <Caption text={captionOf(beat)} speechFrames={beat.speechFrames} size={60} />
      </div>
      <div style={{ position: "absolute", top: 620, left: 50, right: 50, display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        {camp(db.left, l, C.purple)}
        {camp(db.right, r, C.orange)}
      </div>
      <div style={{ position: "absolute", top: 700, left: 0, right: 0, display: "flex", justifyContent: "center", transform: `scale(${vs})` }}>
        <div style={{ width: 120, height: 120, borderRadius: "50%", background: C.bg, border: "5px solid #fff", color: "#fff", fontFamily: HEAD, fontSize: 50, fontWeight: 900, display: "flex", alignItems: "center", justifyContent: "center" }}>VS</div>
      </div>
      <div style={{ position: "absolute", bottom: 360, left: 0, right: 0, display: "flex", justifyContent: "center" }}>
        <div style={{ background: GRAD, color: "#fff", fontFamily: HEAD, fontSize: 46, fontWeight: 900, padding: "18px 40px", borderRadius: 999, transform: `scale(${pulse})`, boxShadow: "0 20px 60px rgba(255,74,200,0.5)" }}>
          💬 {db.prompt ?? "Tulis pendapatmu di komen"}
        </div>
      </div>
      <Sfx name="whoosh" volume={0.45} />
      <Sfx name="impact" at={12} volume={0.5} />
    </AbsoluteFill>
  );
};

export const SCENES: Record<Beat["scene"], React.FC<SceneProps>> = {
  ledger: LedgerScene,
  hook: HookScene,
  host: HostScene,
  point: PointScene,
  chat: ChatScene,
  card: CardScene,
  step: StepScene,
  jp: JpScene,
  app: AppScene,
  cta: CtaScene,
  end: EndScene,
  duel: DuelScene,
  debate: DebateScene,
};
