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
MARGIN = 0.08
SPEED = {"s": 1.0, "c": 1.0, "p": 1.0, "x": 1.0}   # natural speed; no time-stretching (it makes voices sound artificial)
VOICES = {f"{l}_{g}": f"tools/voices/{l}_{g}.wav" for l in ("de", "fr", "en") for g in ("f", "m")}
WLANG = {"de": "de", "fr": "fr", "en": "en"}
LN = {"de": "German", "fr": "French", "en": "English"}
REFTEXT = json.load(open("tools/voices/reftext.json"))
SHARD, SHARDS = int(os.environ.get("SHARD", "0")), int(os.environ.get("SHARDS", "1"))

os.makedirs(OUT, exist_ok=True)
SERVE = bool(os.environ.get("SERVE"))   # keep running and pick up new texts and words within a minute


def load_jobs():
    j = json.load(open("jobs.json"))
    j["jobs"] = j["jobs"][SHARD::SHARDS]   # parallel runners each take every n-th text (the most urgent ones first)
    j["words"] = j.get("words", [])[SHARD::SHARDS]
    return j


jobs = load_jobs()
if not SERVE and not jobs["jobs"] and not jobs["words"]:
    sys.exit(0)

import torch, librosa
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from voice_clean import debreath
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
    thr = max(5e-4, a.max() * 0.01)
    idx = np.where(a > thr)[0]
    if not len(idx):
        return w
    s = max(0, idx[0] - int(0.06 * SR)); e = min(len(w), idx[-1] + int(0.10 * SR))
    return w[s:e]


def similarity(audio, text, lang):
    a16 = librosa.resample(audio, orig_sr=SR, target_sr=16000)
    segs, _ = ASR.transcribe(a16, language=WLANG[lang], beam_size=1, vad_filter=False, condition_on_previous_text=False)
    heard = norm(" ".join(s.text for s in segs))
    return difflib.SequenceMatcher(None, heard.split(), norm(text).split()).ratio(), heard


def word_times(audio, lang):
    """[(normalized word, start s, end s)] of a clip, from the speech recogniser's word timestamps."""
    a16 = librosa.resample(audio, orig_sr=SR, target_sr=16000)
    segs, _ = ASR.transcribe(a16, language=WLANG[lang], beam_size=5, vad_filter=False, condition_on_previous_text=False, word_timestamps=True)
    out = []
    for sg in segs:
        for w in (sg.words or []):
            for t in norm(w.word).split():
                out.append((t, w.start, w.end))
    return out


def cut_point(audio, t0, t1):
    """quietest 10-ms spot between two words (that is where the speaker pauses)"""
    f = int(0.01 * SR)
    a, b = max(0, int((min(t0, t1) - 0.06) * SR)), min(len(audio) - f, int((max(t0, t1) + 0.06) * SR))
    if b <= a:
        return int(t0 * SR)
    best, bi = 9e9, a
    for i in range(a, b, f // 2):
        e = float(np.mean(audio[i:i + f] ** 2))
        if e < best:
            best, bi = e, i
    return bi + f // 2


def lead_trim(x):
    """Drop everything before the first word: silence and an in-breath (quiet noise that is not attached to the word).
    Soft first sounds (s, f, sch, h) stay: from the first loud frame we go back as long as the sound continues."""
    f = int(0.01 * SR)
    n = len(x) // f
    if n < 5:
        return x
    e = 20 * np.log10(np.sqrt(np.mean(x[: n * f].reshape(n, f) ** 2, axis=1)) / (np.abs(x).max() + 1e-9) + 1e-9)
    on = next((i for i in range(n) if e[i] > -24), None)
    if on is None or on == 0:
        return x
    k = on
    while k > 0 and e[k - 1] > -42 and on - k < 15:
        k -= 1
    start = max(0, k * f - int(0.02 * SR))
    y = x[start:].copy()
    fd = min(len(y) // 4, int(0.008 * SR))
    if fd > 0:
        y[:fd] *= np.linspace(0, 1, fd, dtype=np.float32)
    return np.concatenate([np.zeros(int(0.04 * SR), dtype=np.float32), y])


def soft(x):
    x = np.array(x, dtype=np.float32, copy=True)
    f = min(len(x) // 4, int(0.012 * SR))
    if f > 0:
        x[:f] *= np.linspace(0, 1, f, dtype=np.float32); x[-f:] *= np.linspace(1, 0, f, dtype=np.float32)
    return x


def pieces_from_sentence(audio, sent_text, groups, lang):
    """Cut the dictation pieces out of the recorded sentence, so they sound exactly like the whole sentence
    (same voice, same melody). groups: list of texts that together make up the sentence, in order.
    Returns a list of clips, or None if the words cannot be matched safely."""
    sw = norm(sent_text).split()
    gw = [norm(g).split() for g in groups]
    if sum(len(x) for x in gw) != len(sw) or [w for x in gw for w in x] != sw or any(not x for x in gw):
        return None
    wt = word_times(audio, lang)
    if not wt:
        return None
    sm = difflib.SequenceMatcher(None, [w for w, _, _ in wt], sw, autojunk=False)
    st, en = [None] * len(sw), [None] * len(sw)
    for a, b, n in sm.get_matching_blocks():
        for k in range(n):
            st[b + k], en[b + k] = wt[a + k][1], wt[a + k][2]
    # a boundary needs both neighbouring words placed
    cuts, pos = [0], 0
    for x in gw[:-1]:
        pos += len(x)
        if en[pos - 1] is None or st[pos] is None:
            return None
        cuts.append(cut_point(audio, en[pos - 1], st[pos]))
    cuts.append(len(audio))
    if any(cuts[i + 1] - cuts[i] < int(0.25 * SR) for i in range(len(cuts) - 1)):
        return None
    out = []
    for i, g in enumerate(groups):
        x = soft(audio[cuts[i]:cuts[i + 1]])
        x = lead_trim(x)   # a breath at the start of a piece (taken at the comma) is not played
        if len(norm(g).split()) >= 2:
            sim, heard = similarity(x, g, lang)
            if sim < 0.8:
                print(f"  cut check {sim:.2f}: {g} | heard: {heard}", flush=True)
                return None
        out.append(soft(x))
    return out


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
        w, _ = debreath(w, SR)   # no audible in-breath before the first word (or at pauses)
        w = trim(w)
        w = lead_trim(w)
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
    return {"version": 1, "texts": {}, "punct": {}, "words": {}}


def git_save(msg, files):
    """Commit only this run's new files plus the merged index; never touch recordings of the other runners."""
    if os.environ.get("PL_NOGIT"):
        return
    idxp = os.path.join(OUT, "index.json")
    mine = load_index()
    for _ in range(6):
        subprocess.run(["git", "fetch", "-q"], check=True)
        subprocess.run(["git", "reset", "-q", "@{u}"], check=True)               # history = theirs, our new files stay
        subprocess.run(["git", "checkout", "-q", "@{u}", "--", OUT], check=True)  # their recordings + their index
        theirs = load_index()
        theirs["texts"].update({k: v for k, v in mine["texts"].items() if k in NEW})
        theirs["punct"].update({k: v for k, v in mine["punct"].items() if k in NEWP})
        theirs.setdefault("words", {}).update({k: v for k, v in mine.get("words", {}).items() if k in NEWW})
        json.dump(theirs, open(idxp, "w"), ensure_ascii=False)
        subprocess.run(["git", "add", idxp] + files, check=True)
        if subprocess.run(["git", "diff", "--cached", "--quiet"]).returncode == 0:
            return
        subprocess.run(["git", "commit", "-q", "-m", msg], check=True)
        if subprocess.run(["git", "push", "-q"]).returncode == 0:
            return
        time.sleep(3)
    print("push failed", flush=True)


NEW, NEWP, NEWW = set(), set(), set()


def record_words():
    """speaker-button words: batches of up to 40 per language and voice, one file each"""
    by = {}
    for w in jobs.get("words", []):
        by.setdefault((w["lang"], w["v"]), []).append(w)
    for (lang, g), L in by.items():
        for b in range(0, len(L), 40):
            if time.time() - T0 > BUDGET:
                return
            batch = L[b:b + 40]
            t1 = time.time()
            clips = [synth(w["t"], "x", lang, g) for w in batch]
            h = __import__("hashlib").md5("|".join(w["k"] for w in batch).encode()).hexdigest()[:10]
            fn = f"w-{lang}-{g}-{h}.mp3"
            tm = build(clips, os.path.join(OUT, fn))
            idx = load_index()
            idx.setdefault("words", {})
            for w, seg in zip(batch, tm):
                idx["words"][w["k"]] = {"file": f"{OUT}/{fn}", "seg": seg}
                NEWW.add(w["k"])
            json.dump(idx, open(os.path.join(OUT, "index.json"), "w"), ensure_ascii=False)
            print(f"recorded {len(batch)} words ({lang}, {g}) in {time.time()-t1:.0f}s", flush=True)
            git_save(f"Stimme: {len(batch)} Wörter ({lang}, {'Frau' if g=='f' else 'Mann'})", [os.path.join(OUT, fn)])


def main():
    PW = jobs.get("punct", {})
    done = 0
    record_words()
    for j in jobs["jobs"]:
        if time.time() - T0 > BUDGET:
            print("time budget reached; the next run continues", flush=True)
            break
        lang, g = j["lang"], j["v"]
        k = f'{lang}-{g}-{j["id"]}-{j["h"]}'
        t1 = time.time()
        idx = load_index()
        newfiles = []
        pk = f"{lang}-{g}"
        if pk not in idx["punct"] and PW.get(lang):
            keys = list(PW[lang].keys())
            fn = f"punct-{pk}.mp3"
            t = build([synth(PW[lang][x], "x", lang, g) for x in keys], os.path.join(OUT, fn))
            idx["punct"][pk] = {"file": f"{OUT}/{fn}", "map": dict(zip(keys, t)), "clean": 1}
            NEWP.add(pk); newfiles.append(os.path.join(OUT, fn))
        clips = []
        def add(text, kind):
            clips.append(synth(text, kind, lang, g)); return len(clips) - 1
        def put(x):
            clips.append(x); return len(clips) - 1
        si = [add(x, "s") for x in j["s"]]
        # dictation pieces and their parts are cut out of the sentence recordings (same melody as the first reading);
        # only where that is not possible a piece is recorded on its own
        ci, pi, ci_by, pi_by, cut_ok = [None] * len(j["c"]), [None] * len(j["c"]), {}, {}, 0
        c_pos = 0
        for s_idx, sent in enumerate(j["s"]):
            nw, grp = len(norm(sent).split()), []
            while c_pos < len(j["c"]) and sum(len(norm(j["c"][q]).split()) for q in grp) < nw:
                grp.append(c_pos); c_pos += 1
            sub = [(q, r, part) for q in grp for r, part in enumerate(j["p"][q])]
            sent_audio = clips[si[s_idx]]
            cc = pieces_from_sentence(sent_audio, sent, [j["c"][q] for q in grp], lang) if grp else None
            pp = pieces_from_sentence(sent_audio, sent, [x[2] for x in sub], lang) if sub else None
            if cc:
                for q, x in zip(grp, cc):
                    ci[q] = put(x)
                cut_ok += len(grp)
            if pp:
                for (q, r, _), x in zip(sub, pp):
                    pi_by[(q, r)] = put(x)
        for q in range(len(j["c"])):
            if ci[q] is None:
                ci[q] = add(j["c"][q], "c")
            pi[q] = [pi_by[(q, r)] if (q, r) in pi_by else (ci[q] if norm(part) == norm(j["c"][q]) else add(part, "p")) for r, part in enumerate(j["p"][q])]
        print(f"  {cut_ok}/{len(j['c'])} pieces cut from the sentences", flush=True)
        fn = f"{k}.mp3"
        t = build(clips, os.path.join(OUT, fn))
        idx["texts"][k] = {"lang": lang, "file": f"{OUT}/{fn}", "s": [t[i] for i in si], "c": [t[i] for i in ci],
                           "p": [[t[i] for i in row] for row in pi], "at": int(time.time()), "clean": 1, "cut": 2}
        json.dump(idx, open(os.path.join(OUT, "index.json"), "w"), ensure_ascii=False)
        NEW.add(k); newfiles.append(os.path.join(OUT, fn))
        done += 1
        print(f"recorded {k} ({len(clips)} clips) in {time.time()-t1:.0f}s", flush=True)
        git_save(f"Diktat-Stimme: {j.get('title') or j['id']} ({lang}, {'Frau' if g=='f' else 'Mann'})", newfiles)
    print(f"{done} recorded in {time.time()-T0:.0f}s", flush=True)


def refresh():
    """latest state of the repository (other runners' recordings) and the newest list from the app"""
    global jobs
    subprocess.run(["git", "fetch", "-q"], check=False)
    subprocess.run(["git", "reset", "-q", "--hard", "@{u}"], check=False)
    subprocess.run([sys.executable, os.path.join(os.path.dirname(os.path.abspath(__file__)), "voice_jobs.py")], check=False,
                   stdout=subprocess.DEVNULL)
    jobs = load_jobs()


if SERVE and not os.environ.get("PL_NOGIT"):
    while time.time() - T0 < BUDGET:
        refresh()
        if jobs["jobs"] or jobs["words"]:
            main()
        else:
            time.sleep(45)
    print("serve time over", flush=True)
else:
    main()
