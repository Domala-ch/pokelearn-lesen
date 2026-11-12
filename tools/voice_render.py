"""Records PokeLearn dictations with a natural voice (Qwen3-TTS 1.7B, Apache 2.0).

Input  jobs.json (from voice_jobs.py): texts already split into sentences (s), dictation
       pieces (c) and piece parts without punctuation (p), plus the voice (f/m) per text.
Output audio/v/<lang>-<v>-<id>-<hash>.mp3 (all clips of one text in one file, separated by
       silence) and audio/v/index.json with the start/length of every clip – the same format
       the app already uses for recordings.
Every clip is checked by speech recognition (faster-whisper); a clip that does not say the
text (a known weakness of generative voices: skipped or repeated words) is generated again.
Each finished text is committed and pushed right away, so a long run never loses work.
"""
import difflib, json, os, re, subprocess, sys, time, unicodedata, wave
import numpy as np

T0 = time.time()
BUDGET = float(os.environ.get("BUDGET_MIN", "45")) * 60
OUT = "audio/v"
SR = 24000
GAP = 0.45
MARGIN = 0.06
SPEED = {"s": 1.0, "c": 1.0, "p": 1.0, "x": 1.0}   # natural speed; no time-stretching (it makes voices sound artificial)
VOICES = {f"{l}_{g}": f"tools/voices/{l}_{g}.wav" for l in ("de", "fr", "en") for g in ("f", "m")}
WLANG = {"de": "de", "fr": "fr", "en": "en"}
LN = {"de": "German", "fr": "French", "en": "English"}
REFTEXT = json.load(open("tools/voices/reftext.json"))
SHARD, SHARDS = int(os.environ.get("SHARD", "0")), int(os.environ.get("SHARDS", "1"))

os.makedirs(OUT, exist_ok=True)
jobs = json.load(open("jobs.json"))
jobs["jobs"] = jobs["jobs"][SHARD::SHARDS]   # parallel runners each take every n-th text (the most urgent ones first)
if not jobs["jobs"]:
    sys.exit(0)

import torch, librosa
from qwen_tts import Qwen3TTSModel
from faster_whisper import WhisperModel

torch.set_num_threads(os.cpu_count() or 4)
TTS = Qwen3TTSModel.from_pretrained(os.environ.get("TTS_MODEL", "Qwen/Qwen3-TTS-12Hz-1.7B-Base"), device_map="cpu",
                                    dtype=torch.bfloat16 if os.environ.get("TTS_BF16") else torch.float32)
ASR = WhisperModel("small", device="cpu", compute_type="int8")
print(f"models loaded in {time.time()-T0:.0f}s", flush=True)
cur_voice = None


def norm(t):
    t = unicodedata.normalize("NFKC", t.lower()).replace("ß", "ss")
    t = re.sub(r"[«»\"„“”‹›.,!?;:()\-–—']", " ", t)
    return re.sub(r"\s+", " ", t).strip()


def clean(t, lang):
    t = re.sub(r'[«»"„“”‹›]', "", t)
    t = re.sub(r"\s+", " ", t).strip()
    if not re.search(r"[.,!?;:]$", t):
        t += "."          # a closing mark gives the model a clean ending (no trailing babble)
    return t


def trim(w):
    a = np.abs(w)
    thr = max(1e-3, a.max() * 0.02)
    idx = np.where(a > thr)[0]
    if not len(idx):
        return w
    s = max(0, idx[0] - int(0.03 * SR)); e = min(len(w), idx[-1] + int(0.08 * SR))
    return w[s:e]


def similarity(audio, text, lang):
    a16 = librosa.resample(audio, orig_sr=SR, target_sr=16000)
    segs, _ = ASR.transcribe(a16, language=WLANG[lang], beam_size=1, vad_filter=False, condition_on_previous_text=False)
    heard = norm(" ".join(s.text for s in segs))
    return difflib.SequenceMatcher(None, heard.split(), norm(text).split()).ratio(), heard


PROMPTS = {}


def voice(lang, g):
    # the six voices were designed once with Qwen3-TTS VoiceDesign (tools/voices/design.py); every clip clones them
    k = f"{lang}_{g}"
    if k not in PROMPTS:
        PROMPTS[k] = TTS.create_voice_clone_prompt(ref_audio=VOICES[k], ref_text=REFTEXT[lang])
    return PROMPTS[k]


cache = {}


def synth(text, kind, lang, g):
    ct = clean(text, lang)
    # a piece and the same words without the final mark share one recording
    key = (lang, g, norm(ct), kind if kind in ("s", "x") else "c")
    if key in cache:
        return cache[key]
    prompt = voice(lang, g)
    best, best_sim, best_heard = None, -1, ""
    words = len(norm(ct).split())
    for seed in (1234, 77, 4242):
        torch.manual_seed(seed)
        ws, sr = TTS.generate_voice_clone(text=ct, language=LN[lang], voice_clone_prompt=prompt)
        w = np.asarray(ws[0], dtype=np.float32)
        if sr != SR:
            w = librosa.resample(w, orig_sr=sr, target_sr=SR)
        w = trim(w)
        # a clip far too long for its words has babble or repetitions
        if len(w) / SR > 1.5 + words * 0.8:
            sim, heard = 0.0, "(too long)"
        else:
            sim, heard = similarity(w, ct, lang) if words >= 2 else (1.0, "")
        if sim > best_sim:
            best, best_sim, best_heard = w, sim, heard
        if sim >= 0.85:
            break
    w = best
    if SPEED[kind] < 0.99:
        w = librosa.effects.time_stretch(w, rate=SPEED[kind]).astype(np.float32)
    pk = np.abs(w).max() or 1
    w = w / pk * 0.9
    cache[key] = w
    if best_sim < 0.85:
        print(f"  check {best_sim:.2f}: {ct} | heard: {best_heard}", flush=True)
    return w


def encode(wav, path):
    tmp = path + ".wav"
    with wave.open(tmp, "wb") as f:
        f.setnchannels(1); f.setsampwidth(2); f.setframerate(SR)
        f.writeframes((np.clip(wav, -1, 1) * 32767).astype("<i2").tobytes())
    af = ("highpass=f=80,equalizer=f=3200:t=q:w=1.1:g=1.5,highshelf=f=8000:g=-1,"
          "acompressor=threshold=-20dB:ratio=2.2:attack=8:release=120:makeup=1.5,loudnorm=I=-16:TP=-1.5:LRA=7")
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", tmp, "-af", af, "-ar", str(SR), "-ac", "1",
                    "-c:a", "libmp3lame", "-b:a", "64k", path], check=True)
    os.remove(tmp)


def build(clips, path):
    gap = np.zeros(int(GAP * SR), dtype=np.float32)
    parts, timing, pos = [gap], [], len(gap)
    for c in clips:
        timing.append([round(max(0, pos / SR - MARGIN), 3), round(len(c) / SR + 2 * MARGIN, 3)])
        parts += [c, gap]; pos += len(c) + len(gap)
    encode(np.concatenate(parts), path)
    return timing


def load_index():
    p = os.path.join(OUT, "index.json")
    if os.path.exists(p):
        return json.load(open(p))
    return {"version": 1, "texts": {}, "punct": {}}


def git_save(msg):
    if os.environ.get("PL_NOGIT"):
        return
    subprocess.run(["git", "add", OUT], check=True)
    if subprocess.run(["git", "diff", "--cached", "--quiet"]).returncode == 0:
        return
    subprocess.run(["git", "commit", "-q", "-m", msg], check=True)
    for _ in range(5):
        if subprocess.run(["git", "push", "-q"]).returncode == 0:
            return
        # someone else pushed: take theirs, keep our new recordings in the index
        mine = load_index()
        subprocess.run(["git", "fetch", "-q"], check=True)
        subprocess.run(["git", "reset", "-q", "@{u}"], check=True)   # index = theirs, our new files stay in the work tree
        subprocess.run(["git", "checkout", "-q", "@{u}", "--", os.path.join(OUT, "index.json")], check=False)
        theirs = load_index()
        theirs["texts"].update(mine["texts"]); theirs["punct"].update(mine["punct"])
        json.dump(theirs, open(os.path.join(OUT, "index.json"), "w"), ensure_ascii=False)
        subprocess.run(["git", "add", OUT], check=True)
        subprocess.run(["git", "commit", "-q", "-m", msg], check=True)
    print("push failed", flush=True)


def main():
    PW = jobs.get("punct", {})
    done = 0
    for j in jobs["jobs"]:
        if time.time() - T0 > BUDGET:
            print("time budget reached; the next run continues", flush=True)
            break
        lang, g = j["lang"], j["v"]
        k = f'{lang}-{g}-{j["id"]}-{j["h"]}'
        t1 = time.time()
        idx = load_index()
        pk = f"{lang}-{g}"
        if pk not in idx["punct"] and PW.get(lang):
            keys = list(PW[lang].keys())
            fn = f"punct-{pk}.mp3"
            t = build([synth(PW[lang][x], "x", lang, g) for x in keys], os.path.join(OUT, fn))
            idx["punct"][pk] = {"file": f"{OUT}/{fn}", "map": dict(zip(keys, t))}
        clips = []
        def add(text, kind):
            clips.append(synth(text, kind, lang, g)); return len(clips) - 1
        si = [add(x, "s") for x in j["s"]]
        ci = [add(x, "c") for x in j["c"]]
        pi = [[add(x, "p") for x in row] for row in j["p"]]
        fn = f"{k}.mp3"
        t = build(clips, os.path.join(OUT, fn))
        idx["texts"][k] = {"lang": lang, "file": f"{OUT}/{fn}", "s": [t[i] for i in si], "c": [t[i] for i in ci],
                           "p": [[t[i] for i in row] for row in pi], "at": int(time.time())}
        json.dump(idx, open(os.path.join(OUT, "index.json"), "w"), ensure_ascii=False)
        done += 1
        print(f"recorded {k} ({len(clips)} clips) in {time.time()-t1:.0f}s", flush=True)
        git_save(f"Diktat-Stimme: {j.get('title') or j['id']} ({lang}, {'Frau' if g=='f' else 'Mann'})")
    print(f"{done} recorded in {time.time()-T0:.0f}s", flush=True)


main()
