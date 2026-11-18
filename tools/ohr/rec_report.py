"""Lese-Aufnahmen auswerten.  rec_report.py <zip|ordner> [...]  (Python mit faster-whisper)

Für jede Aufnahme (audio.wav + info.json aus der App):
* ein unabhängiger Erkenner (Whisper small, kennt den Text NICHT) schreibt mit, was gelesen wurde,
* jeder Stopp der App wird damit verglichen: hat Whisper kurz vor dem Stopp das richtige Wort gehört → «wohl falscher Stopp»,
  sonst «wohl echter Verleser»,
* Wörter, die die App grün liess, Whisper aber anders hörte → «vielleicht übersehen».
Whisper irrt selbst (ein paar Prozent) — das Ergebnis sind Hinweise zum Nachhören, mit Zeitstempel.
"""
import sys,os,io,json,zipfile,re,difflib,collections,tempfile,wave
import numpy as np
from faster_whisper import WhisperModel
def norm(w): return re.sub(r"[^a-zäöüß0-9]","",w.lower()).replace("ß","ss")
def packages(paths):
    for p in paths:
        if p.endswith(".zip"):
            z=zipfile.ZipFile(p);dirs=sorted({n.rsplit("/",1)[0] for n in z.namelist() if n.endswith("info.json")})
            for d in dirs: yield d,json.loads(z.read(d+"/info.json")),z.read(d+"/audio.wav")
        else:
            for d in sorted(os.listdir(p)):
                q=os.path.join(p,d)
                if os.path.exists(os.path.join(q,"info.json")): yield d,json.load(open(os.path.join(q,"info.json"))),open(os.path.join(q,"audio.wav"),"rb").read()
WM=WhisperModel(os.environ.get("WHISPER","small"),device="cpu",compute_type="int8")
allst=collections.defaultdict(collections.Counter);out=[]
for name,info,wav in packages(sys.argv[1:]):
    w=wave.open(io.BytesIO(wav));a=np.frombuffer(w.readframes(w.getnframes()),np.int16).astype(np.float32)/32768
    segs,_=WM.transcribe(a,language=info["text"].get("lang","de"),word_timestamps=True,beam_size=5,vad_filter=False,condition_on_previous_text=False)
    WW=[(norm(x.word),x.start,x.end) for s in segs for x in (s.words or []) if norm(x.word)]
    E=info["expN"];En=[norm(x) for x in E];Hn=[x[0] for x in WW]
    sm=difflib.SequenceMatcher(None,En,Hn,autojunk=False);wh=[None]*len(E)      # what Whisper heard for each word of the text
    for op,i1,i2,j1,j2 in sm.get_opcodes():
        if op=="equal":
            for k in range(i2-i1): wh[i1+k]=("=",WW[j1+k])
        elif op=="replace":
            for k in range(i2-i1): wh[i1+k]=("≠",WW[j1+k]) if j1+k<j2 else ("∅",None)
        elif op=="delete":
            for k in range(i1,i2): wh[k]=("∅",None)
    ev=info["ev"];hs=[e for e in ev if e["e"]=="h"]
    def ear_at(t):
        last=""
        for e in hs:
            if e["t"]>t+0.01: break
            last=e["w"]
        return " ".join(last.split()[-6:])
    stops=[];seen=set()
    for e in ev:
        if e["e"]=="j" and e["r"] and e["r"][0] not in seen:
            seen.add(e["r"][0]);stops.append((e["t"],e["r"][0],e["r"][2]))
    print(f"\n=== {name} · {info['who']} · {info['text']['title']} · {info['sec']:.0f} s · {info['stats']['words']} Wörter · Stopps {len(stops)} · Strenge {info['set']['strict']}")
    st=allst[info["who"]];st["words"]+=info["stats"]["pos"]
    for t,i,gap in stops:
        win=[x for x in WW if t-3.0<=x[2]<=t+0.15]
        okb=any(x[0]==En[i] for x in win)
        v="wohl FALSCHER Stopp" if okb else "wohl echter Verleser"
        st["stops"]+=1;st["false" if okb else "real"]+=1
        print(f"  {t:6.1f}s  Stopp bei «{E[i]}»{' (nicht gehört)' if gap else ''}: Ohr schrieb «{ear_at(t)}» · Whisper hörte «{' '.join(x[0] for x in win)}» → {v}")
    wst=info["wst"]
    for k,(s,x) in enumerate(zip(wst,wh)):
        if s=="ok" and x and x[0]=="≠" and k not in seen:
            st["miss?"]+=1;print(f"  {x[1][1]:6.1f}s  «{E[k]}» grün · Whisper hörte «{x[1][0]}» → vielleicht übersehen")
    out.append({"name":name,"who":info["who"],"stops":[{"t":t,"word":E[i],"gap":gap} for t,i,gap in stops]})
print("\n=== Zusammenfassung")
for who,c in allst.items():
    print(f"  {who}: {c['words']} Wörter gelesen · {c['stops']} Stopps (wohl falsch {c['false']}, wohl echt {c['real']}) · vielleicht übersehen {c['miss?']}"
          +(f" · falsche Stopps pro 100 Wörter ≈ {c['false']/max(1,c['words'])*100:.2f}" if c['words'] else ""))
