import React from "react";
import { AbsoluteFill, Audio, CalculateMetadataFunction, Composition, Sequence, staticFile } from "remotion";
import { FlatTest } from "./flat";
import { Puppet } from "./puppet";
import { SCENES } from "./scenes";
import { C, FPS, H, W } from "./theme";
import type { Timeline } from "./types";

type Props = { episode: string; timeline?: Timeline };

// Reads public/episodes/<episode>/timeline.json (written by tools/tts.py) and sizes the video to it.
const calculateMetadata: CalculateMetadataFunction<Props> = async ({ props }) => {
  const res = await fetch(staticFile(`episodes/${props.episode}/timeline.json`));
  const timeline = (await res.json()) as Timeline;
  // consecutive app beats on the same screen recording keep playing it instead of restarting
  timeline.beats.forEach((b, i) => {
    const prev = timeline.beats[i - 1];
    if (b.app?.video)
      b.app.videoFrom = prev?.app?.video === b.app.video ? (prev.app.videoFrom ?? 0) + Math.round(prev.frames * (prev.app.rate ?? 1)) : 0;
  });
  return { durationInFrames: timeline.durationInFrames, props: { ...props, timeline } };
};

// consecutive beats with the same ambience play one continuous loop
const ambienceRuns = (tl: Timeline) => {
  const runs: { name: string; from: number; frames: number }[] = [];
  tl.beats.forEach((b) => {
    const last = runs[runs.length - 1];
    if (!b.ambience) return;
    if (last && last.name === b.ambience && last.from + last.frames === b.from) last.frames += b.frames;
    else runs.push({ name: b.ambience, from: b.from, frames: b.frames });
  });
  return runs;
};

export const Episode: React.FC<Props> = ({ timeline: tl }) => {
  if (!tl) return null;
  return (
    <AbsoluteFill style={{ background: C.bg }}>
      {tl.beats.map((b, i) => {
        const Scene = SCENES[b.scene];
        return (
          <Sequence key={i} from={b.from} durationInFrames={b.frames} name={`${i} ${b.scene}`}>
            <Scene beat={b} prev={i > 0 ? tl.beats[i - 1] : null} tl={tl} />
            {b.audio && <Audio src={staticFile(b.audio)} />}
          </Sequence>
        );
      })}
      {ambienceRuns(tl).map((r) => (
        <Sequence key={r.from} from={r.from} durationInFrames={r.frames} name={`amb ${r.name}`}>
          <Audio src={staticFile(`sfx/amb-${r.name}.wav`)} loop volume={(f) => 0.22 * Math.min(1, f / 10, (r.frames - f) / 10)} />
        </Sequence>
      ))}
      {tl.bgm && <Audio src={staticFile(tl.bgm)} volume={0.08} loop />}
    </AbsoluteFill>
  );
};

// Rig check: one character talking over a voice clip (tune RIGS in puppet.tsx here).
const PuppetTest: React.FC<{ image: string; audio: string; zoom: number; force?: { lid?: number; open?: number } }> = ({ image, audio, zoom, force }) => (
  <AbsoluteFill style={{ background: C.bg, alignItems: "center", overflow: "hidden" }}>
    <div style={{ transform: `scale(${zoom})`, transformOrigin: "50% 12%", marginTop: 120 }}>
      <Puppet image={image} width={1000} audio={audio} force={force} />
    </div>
    <Audio src={staticFile(audio)} />
  </AbsoluteFill>
);

export const RemotionRoot: React.FC = () => (
  <>
  <Composition
    id="PuppetTest"
    component={PuppetTest}
    durationInFrames={150}
    fps={FPS}
    width={W}
    height={H}
    defaultProps={{ image: "brand/yui.png", audio: "episodes/jikoshoukai/audio/b8d7faae017f.wav", zoom: 1 }}
  />
  <Composition id="FlatTest" component={FlatTest} durationInFrames={210} fps={FPS} width={W} height={H} />
  <Composition
    id="Mensetsu"
    component={Episode}
    durationInFrames={300}
    fps={FPS}
    width={W}
    height={H}
    defaultProps={{ episode: "jikoshoukai" } as Props}
    calculateMetadata={calculateMetadata}
  />
  </>
);
