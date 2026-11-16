# Reading-grammar bench: Vosk (Kaldi) with a text-specific bigram grammar + confusable variants.
import sys,json,os,re,time,random,numpy as np
sys.path.insert(0,".")
from bench1 import load,T,files
import vosk;vosk.SetLogLevel(-1)
VM=vosk.Model("models/vosk_x/vosk-model-small-de-0.15")
VOC=set(l.strip() for l in open("models/vosk-de-vocab.txt",encoding="utf8"))
ALPHA="abcdefghijklmnopqrstuvwxyzäöüß"
def norm(s):
    s=s.lower();s=re.sub(r"[^a-zäöüßàâçéèêëîïôûùœ0-9' ]"," ",s);return s.split()
def key(w): return w.replace("ß","ss")           # judge: ß and ss are the same word
def forms(w):
    """vocabulary spellings of a text word (ss/ß)"""
    out=[w] if w in VOC else []
    if "ss" in w:
        c=w.replace("ss","ß")
        if c in VOC: out.append(c)
        for m in re.finditer("ss",w):
            c=w[:m.start()]+"ß"+w[m.end():]
            if c in VOC and c not in out: out.append(c)
    if "ß" in w:
        c=w.replace("ß","ss")
        if c in VOC and c not in out: out.append(c)
    return out
FAM=[["der","die","das","den","dem","des"],["ein","eine","einen","einem","einer","eines"],["im","in"],["am","an"],["zum","zur","zu"],["vom","von"],["beim","bei"],
     ["ihm","ihn","ihnen"],["mir","mich"],["dir","dich"],["war","waren","wäre"],["hat","hatte","hatten","haben","habe"],["ist","sind"],["wird","werden","wurde","wurden"],["kann","konnte","können"],
     ["er","es","sie"],["sie","sich"],["wir","wie"],["dass","das"],["man","mann"]]
for stem in ["kein","mein","dein","sein","ihr","unser","euer"]: FAM.append([stem+e for e in ["","e","en","em","er","es"]])
for stem in ["dies","jen","welch","jed","manch","solch"]: FAM.append([stem+e for e in ["e","en","em","er","es"]])
FAMOF={}
for f in FAM:
    for w in f: FAMOF.setdefault(w,set()).update(x for x in f if x!=w)
ENDS=["","e","en","em","er","es","s","n","t","te","ten","st","et","est","ern","nen"]
def stemvars(w):
    out=set()
    if len(w)<4: return out
    for e in sorted(ENDS,key=len,reverse=True):
        if e and w.endswith(e) and len(w)-len(e)>=3: st=w[:-len(e)]
        elif e=="": st=w
        else: continue
        for e2 in ENDS:
            c=st+e2
            if c!=w and c in VOC: out.add(c)
    return out
def ed1(w):
    out=set()
    if len(w)<3: return out
    for i in range(len(w)+1):
        for a in ALPHA:
            c=w[:i]+a+w[i:]
            if c in VOC: out.add(c)
        if i<len(w):
            c=w[:i]+w[i+1:]
            if c in VOC and len(c)>=2: out.add(c)
            for a in ALPHA:
                c=w[:i]+a+w[i+1:]
                if c!=w and c in VOC: out.add(c)
    return out
def variants(w):
    """(closed, lexical): closed-class minimal pairs (equal prior) and other confusable words (low prior)"""
    closed=set(FAMOF.get(w,()))&VOC
    lex=(stemvars(w)|ed1(w))-closed-{w}
    return closed,lex
def grammar(E,mode,rep=1,R=1):
    """E: expected words (normalized).
    mode 'uni': word loop; 'seq': text as one phrase; '+v': variants as single words;
    '+vctx': closed-class variants in context (same prior as the text word when R=1), others single; '+actx': all variants in context.
    R: how many times the text phrase is counted (prior of the text against an in-context variant = R:1)."""
    ph=[];gw=[]
    for w in E:
        f=forms(w);gw.append(f[0] if f else None)
    seq=[x for x in gw if x]
    if mode=="uni": return sorted(set(seq))+["[unk]"],gw
    ph+=[" ".join(seq)]*R
    if mode=="seq": return ph+["[unk]"],gw
    seen=set()
    for i,w in enumerate(E):
        if not gw[i]: continue
        cl,lx=variants(gw[i]) if gw[i] in VOC else (set(),set())
        cl2,lx2=variants(w);cl|=cl2;lx|=lx2
        prev=next((gw[j] for j in range(i-1,-1,-1) if gw[j]),None);nxt=next((gw[j] for j in range(i+1,len(E)) if gw[j]),None)
        def ctx(v):
            p=" ".join(x for x in (prev,v,nxt) if x)
            if p not in seen: seen.add(p);ph.append(p)
        for v in cl:
            if v not in VOC: continue
            if "ctx" in mode: ctx(v)
            elif v not in seen: seen.add(v);ph.extend([v]*rep)
        for v in lx:
            if v not in VOC: continue
            if "actx" in mode: ctx(v)
            elif v not in seen: seen.add(v);ph.extend([v]*rep)
    return ph+["[unk]"]*max(1,rep),gw
def decode(a,g,chunk=0.1):
    rec=vosk.KaldiRecognizer(VM,16000,json.dumps(g,ensure_ascii=False));rec.SetWords(True)
    n=int(16000*chunk);pcm=(np.clip(a,-1,1)*32767).astype(np.int16);fin=[]
    for i in range(0,len(pcm),n):
        if rec.AcceptWaveform(pcm[i:i+n].tobytes()): fin+=json.loads(rec.Result()).get("result",[])
    fin+=json.loads(rec.FinalResult()).get("result",[])
    return fin
def align(E,H):
    """Levenshtein alignment; returns per-expected-word status ok/sub/del and list of insertions (index before which)"""
    n,m=len(E),len(H);d=np.zeros((n+1,m+1));d[:,0]=np.arange(n+1);d[0,:]=np.arange(m+1)
    for i in range(1,n+1):
        for j in range(1,m+1): d[i,j]=min(d[i-1,j]+1,d[i,j-1]+1,d[i-1,j-1]+(0 if E[i-1]==H[j-1] else 1))
    st=[None]*n;ins=[];i,j=n,m
    while i>0 or j>0:
        if i>0 and j>0 and d[i,j]==d[i-1,j-1]+(0 if E[i-1]==H[j-1] else 1): st[i-1]="ok" if E[i-1]==H[j-1] else "sub:"+H[j-1];i-=1;j-=1
        elif i>0 and d[i,j]==d[i-1,j]+1: st[i-1]="del";i-=1
        else: ins.append((i,H[j-1]));j-=1
    return st,ins
def miscue(S,kind,rng):
    """Return (E, p): expected text E that differs from the spoken words S at position p (the reader 'misread' E[p] as S[p])"""
    idx=list(range(1,len(S)-1));rng.shuffle(idx)
    for p in idx:
        s=S[p]
        if kind=="closed":
            c=[v for v in FAMOF.get(s,()) if v in VOC]
            if c: return S[:p]+[rng.choice(sorted(c))]+S[p+1:],p
        elif kind=="ending":
            c=sorted(stemvars(s))
            if c and s not in FAMOF: return S[:p]+[rng.choice(c)]+S[p+1:],p
        elif kind=="near":
            c=sorted(ed1(s)-stemvars(s)-set(FAMOF.get(s,())))
            c=[x for x in c if len(x)>=4]
            if c and len(s)>=4: return S[:p]+[rng.choice(c)]+S[p+1:],p
        elif kind=="gross":
            if len(s)>=4 and s in VOC:
                c=[v for v in GROSS if v!=s and abs(len(v)-len(s))<=3 and v[0]!=s[0]]
                if c: return S[:p]+[rng.choice(c)]+S[p+1:],p
        elif kind=="omit":     # the reader skipped a word: expected text has an extra word
            v=rng.choice(GROSS);return S[:p]+[v]+S[p:],p
        elif kind=="insert":   # the reader added a word: expected text lacks S[p]
            if len(s)>=3: return S[:p]+S[p+1:],p
    return None,None
GROSS=[w for w in ["haus","garten","schule","wasser","fenster","blume","strasse","kinder","morgen","abend","wetter","katze","vogel","tisch","lampe","freund","sommer","winter","berg","wald","stadt","brot","milch","apfel","buch","lehrer","mutter","vater","bruder","schwester","zimmer","küche","spiel","farbe","himmel","sonne","regen","schnee","wind","fluss"] if w in VOC]
if __name__=="__main__":
    cond=sys.argv[1];mode=sys.argv[2];kinds=sys.argv[3].split(",");N=int(sys.argv[4]) if len(sys.argv)>4 else 999;rep=int(sys.argv[5]) if len(sys.argv)>5 else 1;R=int(sys.argv[6]) if len(sys.argv)>6 else 1
    warp=float(sys.argv[7]) if len(sys.argv)>7 else 1.0
    MIS=json.load(open("miscues.json"));audio={};keep=set(files[:N])
    for kind in kinds:
        W=FA=0;det=tot=0;oov=0;unk=0;ex=[]
        for mc in MIS:
            if mc["kind"]!=kind or mc["f"] not in keep: continue
            f=mc["f"];E=mc["E"];p=mc["p"];S=mc["S"]
            if f not in audio:
                a=load(f,cond)
                if warp!=1.0:   # frequency warp: play the audio slower by this factor (lowers pitch and formants), as a child-to-adult normalisation
                    n=int(len(a)*warp);a=np.interp(np.linspace(0,len(a)-1,n),np.arange(len(a)),a).astype(np.float32)
                audio[f]=a
            g,gw=grammar(E,mode,rep,R);oov+=sum(1 for x in gw if not x)
            H=[key(w["word"]) for w in decode(audio[f],g)];unk+=H.count("[unk]")
            st,ins=align([key(w) for w in E],H)
            flags=[i for i,x in enumerate(st) if x!="ok" and gw[i]]
            insf=[i for i,h in ins]
            if kind=="correct": FA+=len(flags);W+=len(E)
            else:
                tot+=1
                if kind=="insert": hit=any(abs(i-p)<=1 for i in insf) or any(abs(i-p)<=1 for i in flags)
                else: hit=p in flags
                det+=hit;FA+=len([i for i in flags if abs(i-p)>1]);W+=len(E)
                if not hit and len(ex)<6: ex.append(f"{E[p] if p<len(E) else ''}←said:{S[p]} heard:{' '.join(H[max(0,p-2):p+3])}")
        if kind=="correct": print(f"{cond:6s} {mode:9s} R{R} w{warp} correct : false flags {FA}/{W} = {FA/W*100:.2f} per 100 words   (unknown words {oov}, [unk] heard {unk})",flush=True)
        else: print(f"{cond:6s} {mode:9s} R{R} w{warp} {kind:7s}: detected {det}/{tot} = {det/max(1,tot)*100:.0f}%   false flags elsewhere {FA/W*100:.2f}/100   missed e.g. {ex[:4]}",flush=True)
