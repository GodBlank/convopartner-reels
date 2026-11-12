import { loadFont as loadPoppins } from "@remotion/google-fonts/Poppins";
import { loadFont as loadJakarta } from "@remotion/google-fonts/PlusJakartaSans";

// Convopartner brand (from convopartner.com landing-v2 CSS variables).
const { fontFamily: poppins } = loadPoppins("normal", { weights: ["600", "700", "800", "900"], subsets: ["latin"] });
const { fontFamily: jakarta } = loadJakarta("normal", { weights: ["500", "600", "700", "800"], subsets: ["latin"] });

// Japanese falls through to the system JP font (Hiragino on macOS).
const JP = `"Hiragino Sans", "Hiragino Kaku Gothic ProN", "Noto Sans JP", sans-serif`;
export const HEAD = `${poppins}, ${JP}`;
export const BODY = `${jakarta}, ${JP}`;

export const W = 1080;
export const H = 1920;
export const FPS = 30;

export const C = {
  bg: "#050816",
  bgElev: "#0C0F22",
  bgElev2: "#141832",
  text: "#F9FAFB",
  muted: "#C3C8D8",
  dim: "#8A91AB",
  purple: "#9B4DFF",
  magenta: "#FF4AC8",
  orange: "#FF9B4A",
  green: "#41D59A",
  gold: "#FFD24A",
  red: "#FF4D6D",
  border: "rgba(155,77,255,0.35)",
  borderStrong: "rgba(155,77,255,0.6)",
  row: "rgba(255,255,255,0.06)",
};

export const GRAD = "linear-gradient(135deg, #9B4DFF, #FF4AC8)";
export const GRAD_TRI = "linear-gradient(135deg, #9B4DFF 0%, #FF4AC8 50%, #FF9B4A 100%)";
