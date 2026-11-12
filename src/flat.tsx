import React from "react";
import { AbsoluteFill, Easing, interpolate, random, useCurrentFrame } from "remotion";
import { HEAD } from "./theme";

// Flat-vector characters built from jointed parts (like cut-out animation), so limbs can bend and the head can
// turn instead of a single painted PNG. Local units: 400 x 1000, feet at (200, 980).

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

export type ArmPose = { shoulder: number; elbow: number }; // degrees; 0 = hanging down, 90 = toward screen right
export type FlatPose = {
  turn: number; // -1 profile left … 0 facing camera … 1 profile right
  armL: ArmPose; // arm on screen left
  armR: ArmPose; // arm on screen right
  walk?: number; // walk-cycle phase in radians (undefined = standing)
  blink?: number; // 0 open … 1 closed
  talk?: number; // mouth open 0..1
  bob?: number; // extra body lift (px)
};

export type FlatLook = { skin: string; hijab?: string; hijabShade?: string; hair?: string; jacket: string; jacketShade: string; shirt: string; bottom: string; shoe: string };

export const RINA: FlatLook = {
  skin: "#E9B591",
  hijab: "#D8BE9C",
  hijabShade: "#C2A47F",
  jacket: "#2C2B36",
  jacketShade: "#1E1D26",
  shirt: "#F4F1EC",
  bottom: "#25232C",
  shoe: "#16151B",
};

const dir = (deg: number, len: number) => [Math.sin((deg * Math.PI) / 180) * len, Math.cos((deg * Math.PI) / 180) * len];

const Arm: React.FC<{ at: [number, number]; pose: ArmPose; look: FlatLook; back?: boolean }> = ({ at, pose, look, back }) => {
  const [ux, uy] = dir(pose.shoulder, 118);
  const ex = at[0] + ux;
  const ey = at[1] + uy;
  const [fx, fy] = dir(pose.shoulder + pose.elbow, 104);
  const hx = ex + fx;
  const hy = ey + fy;
  const [cx, cy] = dir(pose.shoulder + pose.elbow, 92);
  const sleeve = back ? look.jacketShade : look.jacket;
  return (
    <g>
      <line x1={at[0]} y1={at[1]} x2={ex} y2={ey} stroke={sleeve} strokeWidth={38} strokeLinecap="round" />
      <line x1={ex} y1={ey} x2={ex + cx} y2={ey + cy} stroke={sleeve} strokeWidth={33} strokeLinecap="round" />
      <circle cx={ex + cx * 1.02} cy={ey + cy * 1.02} r={15} fill={look.shirt} />
      <circle cx={hx} cy={hy} r={17} fill={look.skin} />
    </g>
  );
};

const Head: React.FC<{ pose: FlatPose; look: FlatLook }> = ({ pose, look }) => {
  const t = pose.turn;
  const fx = 200 + t * 16; // face centre slides toward where she looks
  const eyeGap = 21 * (1 - Math.abs(t) * 0.35);
  const eyes = [-1, 1].map((side) => {
    const far = side * Math.sign(t || 1) < 0 && Math.abs(t) > 0.05; // eye on the side turning away
    const squash = far ? 1 - Math.abs(t) * 0.55 : 1;
    return { x: fx + side * eyeGap + t * 10, w: 7 * squash, hide: far && Math.abs(t) > 0.8 };
  });
  const lid = pose.blink ?? 0;
  const open = pose.talk ?? 0;
  const mx = fx + t * 14;
  return (
    <g>
      {/* hijab: head + a rounded bib over the neck and chest */}
      <path d={`M ${122 + t * 4} 262 Q ${108} 392 ${152 + t * 6} 428 Q ${200 + t * 8} 450 ${248 + t * 6} 428 Q ${292} 392 ${278 + t * 4} 262 Z`} fill={look.hijab} />
      <path d={`M ${150 + t * 6} 410 Q ${200 + t * 8} 436 ${250 + t * 6} 410`} stroke={look.hijabShade} strokeWidth={5} fill="none" strokeLinecap="round" />
      <ellipse cx={200 + t * 4} cy={226} rx={84} ry={92} fill={look.hijab} />
      {/* face */}
      <ellipse cx={fx} cy={238} rx={56 - Math.abs(t) * 6} ry={64} fill={look.skin} />
      {/* hijab rim framing the face */}
      <path d={`M ${fx - 62} 210 Q ${fx} 140 ${fx + 62} 210`} stroke={look.hijab} strokeWidth={22} fill="none" strokeLinecap="round" />
      {/* brows */}
      {eyes.map((e, i) => !e.hide && <path key={`b${i}`} d={`M ${e.x - 10} 214 Q ${e.x} 208 ${e.x + 10} 214`} stroke="#5A3A2C" strokeWidth={3.5} fill="none" strokeLinecap="round" />)}
      {/* eyes (squash to a lash line when blinking) */}
      {eyes.map((e, i) =>
        e.hide ? null : lid > 0.6 ? (
          <path key={i} d={`M ${e.x - 8} 238 Q ${e.x} 243 ${e.x + 8} 238`} stroke="#2B1B17" strokeWidth={3.5} fill="none" strokeLinecap="round" />
        ) : (
          <g key={i}>
            <ellipse cx={e.x} cy={238} rx={e.w} ry={10 * (1 - lid)} fill="#2B1B17" />
            <circle cx={e.x + 2 + t * 2} cy={234} r={2.6} fill="#fff" />
          </g>
        ),
      )}
      {/* blush + nose */}
      <ellipse cx={fx - 30 + t * 12} cy={262} rx={11} ry={6} fill="#F08C8C" opacity={0.45} />
      <ellipse cx={fx + 30 + t * 12} cy={262} rx={11} ry={6} fill="#F08C8C" opacity={0.45 * (1 - Math.max(0, -t))} />
      <path d={`M ${fx + t * 22} 252 l ${2 + t * 4} 8`} stroke="#C98B6A" strokeWidth={3} strokeLinecap="round" />
      {/* mouth: smile, or open while talking */}
      {open > 0.08 ? (
        <ellipse cx={mx} cy={279} rx={9} ry={3 + open * 7} fill="#8A3540" />
      ) : (
        <path d={`M ${mx - 11} 276 Q ${mx} 286 ${mx + 11} 276`} stroke="#8A3540" strokeWidth={3.5} fill="none" strokeLinecap="round" />
      )}
    </g>
  );
};

export const FlatCharacter: React.FC<{ pose: FlatPose; look?: FlatLook; height?: number }> = ({ pose, look = RINA, height = 1000 }) => {
  const w = pose.walk;
  const step = w === undefined ? 0 : Math.sin(w);
  const lift = (w === undefined ? 0 : -Math.abs(Math.sin(w)) * 8) - (pose.bob ?? 0);
  const breathe = 1 + Math.sin(useCurrentFrame() / 22) * 0.006;
  return (
    <svg viewBox="0 0 400 1000" width={height * 0.4} height={height} style={{ overflow: "visible" }}>
      {/* ground shadow */}
      <ellipse cx={200} cy={982} rx={110} ry={16} fill="#000" opacity={0.28} />
      {/* feet peek out under the skirt and step */}
      {[-1, 1].map((s) => (
        <ellipse key={s} cx={200 + s * 34 + (w === undefined ? 0 : s * step * 24)} cy={962 + (w === undefined ? 0 : Math.min(0, s * Math.cos(w) * 10))} rx={30} ry={13} fill={look.shoe} />
      ))}
      <g transform={`translate(0 ${lift}) translate(200 560) scale(1 ${breathe}) translate(-200 -560)`}>
        {/* skirt (hem sways while walking) */}
        <path d={`M 138 520 L 262 520 L ${292 + step * 8} 950 Q 200 962 ${108 + step * 8} 950 Z`} fill={look.bottom} />
        <Arm at={[134, 352]} pose={pose.armL} look={look} back />
        {/* jacket body + shirt V */}
        <path d="M 128 330 Q 200 305 272 330 L 276 575 Q 200 600 124 575 Z" fill={look.jacket} />
        <path d="M 172 400 L 200 478 L 228 400 Z" fill={look.shirt} />
        <path d="M 172 400 L 200 478 L 188 520 L 156 410 Z" fill={look.jacketShade} />
        <path d="M 228 400 L 200 478 L 212 520 L 244 410 Z" fill={look.jacketShade} />
        <circle cx={200} cy={505} r={6} fill="#0E0D12" />
        <g>
          <Head pose={pose} look={look} />
        </g>
        <Arm at={[266, 352]} pose={pose.armR} look={look} />
      </g>
    </svg>
  );
};

// ------------------------------------------------------------------ prototype scene: walk in, turn, wave

const FlatRoom: React.FC = () => (
  <AbsoluteFill>
    <svg viewBox="0 0 1080 1920" width={1080} height={1920}>
      <defs>
        <radialGradient id="lamp" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#FFD58A" stopOpacity={0.55} />
          <stop offset="1" stopColor="#FFD58A" stopOpacity={0} />
        </radialGradient>
      </defs>
      <rect width={1080} height={1920} fill="#2E3160" />
      {Array.from({ length: 14 }, (_, i) => (
        <rect key={i} x={0} y={260 + i * 70} width={1080} height={2} fill="#262852" />
      ))}
      <rect x={640} y={330} width={300} height={380} rx={150} fill="#141A3D" />
      <rect x={640} y={500} width={300} height={10} fill="#3B3F72" />
      <rect x={785} y={330} width={10} height={380} fill="#3B3F72" />
      <circle cx={860} cy={420} r={38} fill="#EDE6CF" />
      {Array.from({ length: 10 }, (_, i) => (
        <circle key={i} cx={660 + random(`st${i}`) * 260} cy={360 + random(`sy${i}`) * 320} r={2} fill="#fff" opacity={0.7} />
      ))}
      <rect x={0} y={1560} width={1080} height={360} fill="#1F2145" />
      <rect x={60} y={1290} width={300} height={22} rx={6} fill="#5B3F33" />
      <rect x={80} y={1312} width={18} height={250} fill="#4A332A" />
      <rect x={322} y={1312} width={18} height={250} fill="#4A332A" />
      <circle cx={140} cy={1200} r={180} fill="url(#lamp)" />
      <path d="M 110 1200 L 170 1200 L 155 1160 L 125 1160 Z" fill="#E7B54F" />
      <rect x={136} y={1200} width={8} height={90} fill="#3A2A22" />
    </svg>
  </AbsoluteFill>
);

export const FlatTest: React.FC = () => {
  const f = useCurrentFrame();
  const walking = f < 78;
  const x = interpolate(f, [0, 78], [-300, 320], { ...clamp, easing: Easing.out(Easing.quad) });
  const phase = f * 0.32;
  const turn = interpolate(f, [80, 100], [0.85, 0.08], { ...clamp, easing: Easing.inOut(Easing.cubic) });
  const raise = interpolate(f, [104, 118, 176, 192], [0, 1, 1, 0], { ...clamp, easing: Easing.inOut(Easing.cubic) });
  const wave = Math.sin((f - 118) / 3.2) * 28 * interpolate(f, [116, 122, 172, 178], [0, 1, 1, 0], clamp);
  const swing = walking ? Math.sin(phase) * 16 : 0;
  const blinks = [96, 150, 200];
  const blink = blinks.reduce((m, b) => Math.max(m, interpolate(f, [b, b + 2, b + 5], [0, 1, 0], clamp)), 0);
  const talk = f > 120 && f < 172 ? Math.max(0, Math.sin(f / 2.6)) * 0.9 : 0;
  const pose: FlatPose = {
    turn: walking ? 0.85 : turn,
    walk: walking ? phase : undefined,
    armL: { shoulder: -8 - swing, elbow: 10 },
    armR: { shoulder: 8 + swing + raise * 142, elbow: -6 + raise * (40 + wave) },
    blink,
    talk,
    bob: f > 194 ? Math.max(0, Math.sin((f - 194) / 3)) * 6 : 0,
  };
  return (
    <AbsoluteFill style={{ background: "#2E3160" }}>
      <FlatRoom />
      <div style={{ position: "absolute", left: x, top: 520 }}>
        <FlatCharacter pose={pose} height={1100} />
      </div>
      <div style={{ position: "absolute", top: 1660, left: 0, right: 0, display: "flex", justifyContent: "center", opacity: interpolate(f, [118, 124], [0, 1], clamp) }}>
        <div style={{ background: "#F6F1E7", color: "#1C1B2A", fontFamily: HEAD, fontSize: 52, fontWeight: 800, padding: "18px 36px", borderRadius: 22 }}>
          はじめまして！ <span style={{ background: "#F5C542", borderRadius: 8, padding: "0 8px" }}>Rina</span> です
        </div>
      </div>
    </AbsoluteFill>
  );
};
