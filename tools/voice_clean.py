"""Removes the audible in-breath that generative voices put before speaking.

A breath looks like this in the level curve (10 ms frames, dB relative to the clip's peak):
silence -> a quiet, unvoiced noise island (-48 … -20 dB, at least 80 ms) -> a short dip -> speech.
Consonants at the start of a word (s, f, sch, h …) are different: they run straight into the vowel
without a dip and are louder, so they are kept. Every island that matches is replaced by silence.

  python tools/voice_clean.py            # cleans all recordings listed in audio/v/index.json (timings stay)
"""
import json, os, subprocess, sys, io
import numpy as np

FR = 0.01


def levels(x, sr, peak):
    f = int(FR * sr)
    n = len(x) // f
    if n == 0:
        return np.zeros(0)
    e = np.sqrt(np.mean(x[: n * f].reshape(n, f) ** 2, axis=1))
    return 20 * np.log10(e / (peak or 1) + 1e-9)


def breath_spans(x, sr, peak=None):
    """[(start_sample, end_sample)] of breath islands in x."""
    peak = peak or float(np.abs(x).max() or 1)
    e = levels(x, sr, peak)
    f = int(FR * sr)
    spans, i, n = [], 0, len(e)
    while i < n:
        # island starts after silence (or at the start of the clip)
        if -48 < e[i] <= -20 and (i == 0 or e[i - 1] <= -48):
            j = i
            while j < n and -48 < e[j] <= -20:
                j += 1
            length = j - i
            # must end in a dip (<= -48 dB, or at least a clear drop) and speech must follow within 120 ms
            dip = j < n and e[j] <= -45
            speech = any(e[k] > -24 for k in range(j, min(n, j + 12)))
            if 8 <= length <= 70 and dip and speech:
                spans.append((i * f, j * f))
            i = j
        else:
            i += 1
    return spans


def debreath(x, sr, cut_leading=True):
    """Silence breath islands. With cut_leading, a breath at the very start is cut off entirely."""
    x = np.array(x, dtype=np.float32, copy=True)
    sp = breath_spans(x, sr)
    fade = int(0.006 * sr)
    for s, e in sp:
        x[s:e] = 0
        # soft edges
        if s >= fade:
            x[s - fade:s] *= np.linspace(1, 0, fade, dtype=np.float32)
    if cut_leading and sp and sp[0][0] <= int(0.12 * sr):
        x = x[max(0, sp[0][1] - int(0.04 * sr)):]
    return x, len(sp)


def clean_file(path, segments, sr=24000):
    raw = subprocess.run(["ffmpeg", "-loglevel", "error", "-i", path, "-f", "f32le", "-ac", "1", "-ar", str(sr), "-"],
                         capture_output=True, check=True).stdout
    a = np.frombuffer(raw, dtype=np.float32).copy()
    total = 0
    for st, du in segments:
        s, e = int(st * sr), min(len(a), int((st + du) * sr))
        y, k = debreath(a[s:e], sr, cut_leading=False)   # keep timings: silence only
        a[s:e] = y
        total += k
    if total:
        tmp = path + ".wav"
        with open(tmp, "wb") as f:
            import wave
            w = wave.open(f, "wb"); w.setnchannels(1); w.setsampwidth(2); w.setframerate(sr)
            w.writeframes((np.clip(a, -1, 1) * 32767).astype("<i2").tobytes()); w.close()
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", tmp, "-ar", str(sr), "-ac", "1", "-c:a", "libmp3lame",
                        "-b:a", "64k", path], check=True)
        os.remove(tmp)
    return total


if __name__ == "__main__":
    idx = json.load(open("audio/v/index.json"))
    done = 0
    for k, t in idx["texts"].items():
        if t.get("clean"):
            continue
        segs = t["s"] + t["c"] + [x for r in t["p"] for x in r]
        n = clean_file(t["file"], segs)
        t["clean"] = 1
        done += 1
        print(k, n, "breaths removed", flush=True)
    for k, t in idx["punct"].items():
        if t.get("clean"):
            continue
        print(k, clean_file(t["file"], list(t["map"].values())), "breaths removed (punctuation)")
        t["clean"] = 1
    json.dump(idx, open("audio/v/index.json", "w"), ensure_ascii=False)
    print(done, "files cleaned")
