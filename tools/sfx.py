#!/usr/bin/env python3
"""sfx.py — synthesise the small sound effects into public/sfx/ (run once)."""
import os, wave
import numpy as np

SR = 44100
OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "public", "sfx")


def save(name, x):
    x = np.clip(x / (np.abs(x).max() + 1e-9) * 0.9, -1, 1)
    with wave.open(os.path.join(OUT, name), "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes((x * 32767).astype(np.int16).tobytes())


def t(sec):
    return np.arange(int(SR * sec)) / SR


def main():
    os.makedirs(OUT, exist_ok=True)
    rng = np.random.default_rng(7)

    # impact: pitch-dropping sub boom + noise crack
    a = t(0.7)
    boom = np.sin(2 * np.pi * np.cumsum(120 * np.exp(-a * 6) + 38) / SR) * np.exp(-a * 5)
    crack = rng.normal(0, 1, a.size) * np.exp(-a * 40)
    save("impact.wav", boom + 0.35 * crack)

    # whoosh: band-swept noise swelling then fading
    a = t(0.45)
    n = rng.normal(0, 1, a.size)
    env = np.sin(np.pi * a / a[-1]) ** 2
    sweep = np.convolve(n, np.ones(12) / 12, "same") - np.convolve(n, np.ones(60) / 60, "same")
    save("whoosh.wav", sweep * env)

    # pop: short pitched blip
    a = t(0.12)
    save("pop.wav", np.sin(2 * np.pi * (900 - 2500 * a) * a) * np.exp(-a * 35))

    # ding: two bright partials (success)
    a = t(0.9)
    save("ding.wav", (np.sin(2 * np.pi * 1318 * a) + 0.5 * np.sin(2 * np.pi * 1976 * a)) * np.exp(-a * 4))

    # buzz: low square-ish "wrong" tone
    a = t(0.35)
    save("buzz.wav", np.sign(np.sin(2 * np.pi * 140 * a)) * 0.6 * np.exp(-a * 6))

    # ambience loops (12 s) for story scenes: public/sfx/amb-<name>.wav
    def lp(x, n):  # crude low-pass: moving average
        return np.convolve(x, np.ones(n) / n, "same")

    def brown(n):
        b = np.cumsum(rng.normal(0, 1, n)); return b - lp(b, 4000)

    a = t(12)
    n = a.size
    fade = np.minimum(1, np.minimum(a, a[-1] - a) / 0.3)  # soft loop seam

    # room: quiet low hum
    save("amb-room.wav", (lp(brown(n), 30) + 0.15 * np.sin(2 * np.pi * 60 * a)) * fade * 0.4)

    # crowd: many voice-band murmurs with random swells
    crowd = np.zeros(n)
    for i in range(14):
        v = lp(rng.normal(0, 1, n), 8) - lp(rng.normal(0, 1, n), 40)
        env = np.clip(np.sin(2 * np.pi * (0.25 + rng.random() * 0.6) * a + rng.random() * 6), 0, 1) ** 2
        crowd += v * env
    save("amb-crowd.wav", crowd * fade)

    # rain: hiss + random drops
    rain = rng.normal(0, 1, n) - lp(rng.normal(0, 1, n), 6)
    for k in rng.integers(0, n - 2000, 260):
        d = t(0.03); rain[k:k + d.size] += rng.normal(0, 3, d.size) * np.exp(-d * 150)
    save("amb-rain.wav", rain * fade)

    # train: rumble + clack-clack every ~1.2 s
    train = lp(brown(n), 60) * 2
    for s0 in np.arange(0.3, 12, 1.2):
        for off in (0, 0.14):
            k = int((s0 + off) * SR); d = t(0.06)
            train[k:k + d.size] += np.sin(2 * np.pi * 180 * d) * np.exp(-d * 60) * 4
    save("amb-train.wav", train * fade)

    # tick: clock ticking over a quiet room
    tick = lp(brown(n), 30) * 0.08
    for s0 in np.arange(0.2, 12, 1.0):
        k = int(s0 * SR); d = t(0.02)
        tick[k:k + d.size] += np.sin(2 * np.pi * 2500 * d) * np.exp(-d * 300)
    save("amb-tick.wav", tick * fade)

    # city: distant traffic wash
    save("amb-city.wav", (lp(brown(n), 20) + 0.3 * lp(rng.normal(0, 1, n), 20)) * fade)
    print("wrote", sorted(os.listdir(OUT)))


if __name__ == "__main__":
    main()
