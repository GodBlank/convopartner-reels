import React from "react";
import { Img, random, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { useAudioData, visualizeAudio } from "@remotion/media-utils";

// A character PNG brought to life without new art: blinking lids, a mouth driven by the voice,
// breathing and a slow idle sway. Coordinates are in the source image's pixels.
// An eye is the ellipse from upper to lower lash; `rot` is its own tilt, `skin` the lid colour (top, bottom).
type Eye = { x: number; y: number; w: number; h: number; rot: number; skin: [string, string] };
export type Rig = {
  w: number;
  h: number;
  lash: string;
  tilt: number; // head tilt in degrees (lids and mouth follow it)
  eyes: Eye[];
  mouth?: { x: number; y: number; w: number; h: number; closedLine?: boolean };
  pivot: [number, number]; // sway pivot (0..1 of the image), usually the feet
  // moving hand cut by tools/rig.py: <cut>-arm.png over <cut>-base.png (hand removed, hole filled), turned around `at`
  arm?: { cut: string; at: [number, number]; kind: "pump" | "present" | "fidget" };
};

// story characters: 1073x1600 cut-outs from Gemini (eyes measured on the art, lid colours sampled by tools/rig.py)
const story = (cut: string, eyes: [number, number, number, number][], skins: [string, string][], arm: NonNullable<Rig["arm"]>["kind"], at: [number, number]): Rig => ({
  w: 1073,
  h: 1600,
  lash: "#3A2420",
  tilt: 0,
  eyes: eyes.map(([x, y, w, h], i) => ({ x, y, w, h, rot: 0, skin: skins[i] })),
  pivot: [0.5, 1],
  arm: { cut, at, kind: arm },
});

export const RIGS: Record<string, Rig> = {
  "brand/yui.png": {
    w: 600,
    h: 900,
    lash: "#4A3026",
    tilt: -14,
    eyes: [
      { x: 285, y: 191, w: 35, h: 29, rot: -4, skin: ["#F0BE98", "#FAC8A6"] },
      { x: 368, y: 169, w: 47, h: 30, rot: -12, skin: ["#F2C29E", "#FBCBAA"] },
    ],
    mouth: { x: 329, y: 235, w: 15, h: 10 },
    pivot: [0.5, 1],
  },
  "story/chars/dimas.png": story("dimas", [[452, 278, 55, 34], [570, 272, 66, 30]], [["#C4815C", "#D8926A"], ["#C88760", "#D5906A"]], "present", [728, 1010]),
  "story/chars/rina.png": story("rina", [[474, 225, 48, 34], [572, 218, 55, 30]], [["#EAAA88", "#E89E7E"], ["#DA9070", "#E69678"]], "fidget", [493, 730]),
  "story/chars/rina-senang.png": story("rina-senang", [[472, 227, 50, 38], [571, 218, 57, 32]], [["#E9A284", "#EC957A"], ["#E5A080", "#EA9378"]], "pump", [348, 650]),
  "story/chars/rina-sedih.png": story("rina-sedih", [[474, 225, 48, 34], [571, 218, 54, 30]], [["#E1977D", "#D77D6A"], ["#EAA487", "#E48973"]], "fidget", [511, 712]),
};

// hand motion per frame: rotation (deg) and lift (source px); amp 0..1 (idle ~0.3, talking 1)
const armPose = (kind: NonNullable<Rig["arm"]>["kind"], f: number, amp: number) => {
  if (kind === "pump") return { rot: Math.sin(f / 3.2) * 9 * amp, y: -Math.abs(Math.sin(f / 3.2)) * 10 * amp };
  if (kind === "present") return { rot: Math.sin(f / 9) * 7 * amp, y: Math.sin(f / 9) * -6 * amp };
  return { rot: Math.sin(f / 11) * 3 * amp, y: Math.sin(f / 7) * 5 * amp };
};

const BLINK = [0.5, 1, 1, 0.5]; // lid closure per frame of a blink

const blinkAt = (frame: number, seed: string) => {
  let t = Math.floor(random(seed) * 40) + 20;
  let i = 0;
  while (t + BLINK.length <= frame) {
    i++;
    // mostly single blinks every 2.5–4.5 s, sometimes a quick double
    t += random(`${seed}-${i}`) < 0.15 ? 8 : Math.floor(75 + random(`${seed}-g${i}`) * 60);
  }
  const k = frame - t;
  return k >= 0 && k < BLINK.length ? BLINK[k] : 0;
};

const useMouth = (src: string | null | undefined, active: boolean) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const data = useAudioData(src ? staticFile(src) : staticFile("sfx/pop.wav"));
  if (!src || !data || !active) return 0;
  const level = (f: number) => {
    if (f < 0) return 0;
    const v = visualizeAudio({ fps, frame: f, audioData: data, numberOfSamples: 16 });
    return Math.sqrt((v[0] + v[1] + v[2] + v[3]) / 4);
  };
  const raw = (level(frame) * 2 + level(frame - 1)) / 3;
  return Math.max(0, Math.min(1, (raw - 0.06) * 3.2));
};

// The eye squashes toward its lower lash (a clipped copy of the art scaled down) over a skin lid,
// so a blink reads as the eye closing rather than a patch sliding over it.
const Lid: React.FC<{ eye: Eye; lid: number; s: number; rig: Rig; image: string }> = ({ eye: e, lid, s, rig, image }) => {
  const w = e.w * s;
  const h = e.h * s;
  const feather = "radial-gradient(ellipse 50% 50% at 50% 50%, #000 62%, transparent 100%)";
  return (
    <div
      style={{
        position: "absolute",
        left: e.x * s - w / 2,
        top: e.y * s - h / 2,
        width: w,
        height: h,
        transform: `rotate(${e.rot}deg)`,
      }}
    >
      <div style={{ position: "absolute", inset: 0, WebkitMaskImage: feather, maskImage: feather }}>
        <div style={{ position: "absolute", inset: 0, background: `linear-gradient(${e.skin[0]}, ${e.skin[1]})`, opacity: Math.min(1, lid * 2) }} />
        <div
          style={{
            position: "absolute",
            inset: 0,
            transform: `scaleY(${1 - lid * 0.92})`,
            transformOrigin: "50% 88%",
            opacity: lid > 0.7 ? 1 - (lid - 0.7) / 0.3 : 1,
          }}
        >
          <div
            style={{
              position: "absolute",
              left: w / 2 - e.x * s,
              top: h / 2 - e.y * s,
              width: rig.w * s,
              height: rig.h * s,
              transform: `rotate(${-e.rot}deg)`,
              transformOrigin: `${e.x * s}px ${e.y * s}px`,
            }}
          >
            <Img src={staticFile(image)} style={{ width: "100%", height: "100%" }} />
          </div>
        </div>
      </div>
      {lid > 0.7 && (
        <svg width={w} height={h} style={{ position: "absolute", inset: 0, overflow: "visible", opacity: (lid - 0.7) / 0.3 }}>
          <path
            d={`M ${w * 0.06} ${h * 0.68} Q ${w * 0.5} ${h * 0.96} ${w * 0.94} ${h * 0.64}`}
            stroke={rig.lash}
            strokeWidth={Math.max(1.5, 1.8 * s)}
            strokeLinecap="round"
            fill="none"
          />
        </svg>
      )}
    </div>
  );
};

export const Puppet: React.FC<{
  image: string;
  width: number;
  audio?: string | null; // the voice that drives the mouth
  talking?: boolean;
  seed?: string;
  force?: { lid?: number; open?: number }; // freeze lid/mouth for rig tuning stills
  gesture?: number; // hand motion strength 0..1
  sway?: boolean; // idle body sway (off when the scene already moves the body)
}> = ({ image, width, audio, talking = true, seed = image, force, gesture = 0.3, sway: swayOn = true }) => {
  const frame = useCurrentFrame();
  const rig = RIGS[image];
  const voiced = useMouth(audio, talking && !!rig);
  const open = force?.open ?? voiced;
  if (!rig) return <Img src={staticFile(image)} style={{ width }} />;

  const s = width / rig.w;
  const lid = force?.lid ?? blinkAt(frame, seed);
  const breathe = swayOn ? 1 + Math.sin(frame / 24) * 0.008 : 1;
  const sway = !swayOn ? 0 : Math.sin(frame / 55) * 0.6 + (talking ? Math.sin(frame / 9) * open * 0.6 : 0);
  const at = (x: number, y: number, w: number, h: number): React.CSSProperties => ({
    position: "absolute",
    left: (x - w / 2) * s,
    top: (y - h / 2) * s,
    width: w * s,
    height: h * s,
    transform: `rotate(${rig.tilt}deg)`,
  });

  return (
    <div
      style={{
        position: "relative",
        width,
        height: rig.h * s,
        transform: `rotate(${sway}deg) scaleY(${breathe})`,
        transformOrigin: `${rig.pivot[0] * 100}% ${rig.pivot[1] * 100}%`,
      }}
    >
      <Img src={staticFile(rig.arm ? `story/rig/${rig.arm.cut}-base.png` : image)} style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} />
      {rig.arm && (() => {
        const p = armPose(rig.arm.kind, frame, gesture);
        return (
          <Img
            src={staticFile(`story/rig/${rig.arm.cut}-arm.png`)}
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              transform: `translateY(${p.y * s}px) rotate(${p.rot}deg)`,
              transformOrigin: `${rig.arm.at[0] * s}px ${rig.arm.at[1] * s}px`,
            }}
          />
        );
      })()}
      {lid > 0 && rig.eyes.map((e, i) => <Lid key={i} eye={e} lid={lid} s={s} rig={rig} image={image} />)}
      {open > 0.04 && rig.mouth && (
        <div style={at(rig.mouth.x, rig.mouth.y + (rig.mouth.h * open) / 4, rig.mouth.w * (0.8 + open * 0.3), rig.mouth.h * open)}>
          <div
            style={{
              width: "100%",
              height: "100%",
              borderRadius: "45% 45% 50% 50%",
              background: "#7A2E35",
              border: `${Math.max(1, 1.2 * s)}px solid #5A2228`,
              overflow: "hidden",
              boxSizing: "border-box",
            }}
          >
            <div style={{ position: "absolute", left: "15%", right: "15%", bottom: 0, height: "45%", borderRadius: "50% 50% 0 0", background: "#D9707A" }} />
          </div>
        </div>
      )}
    </div>
  );
};
