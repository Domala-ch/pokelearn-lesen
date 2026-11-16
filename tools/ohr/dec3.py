# Streaming decode for the bench: saves what the recognizer showed after every 0.1 s of sound (final + still-open words).
# usage: dec3.py cond "R,kc,ke,kn[;R,kc,ke,kn...]" [warp] [kinds] [N] [step]
import sys,json,os,time,numpy as np
sys.path.insert(0,".")
from bench1 import load,files
import vosk;vosk.SetLogLevel(-1)
cond=sys.argv[1];cfgs=[[int(x) for x in c.split(",")] for c in sys.argv[2].split(";")];warp=float(sys.argv[3]) if len(sys.argv)>3 else 1.0
kinds=sys.argv[4].split(",") if len(sys.argv)>4 else ["correct","closed","near","gross"];N=int(sys.argv[5]) if len(sys.argv)>5 else 999;step=int(sys.argv[6]) if len(sys.argv)>6 else 1
GF=os.environ.get("GRAMMARS","grammars.json");UNK=int(os.environ.get("UNK","1"));GARB=[int(x) for x in os.environ.get("GARB","0,1").split(",")]
LEXW=[l.strip() for l in open("web/ohr/de-lex.txt",encoding="utf8").read().split("\n")[1:6000]]
VM=vosk.Model("models/vosk_x/slim/model")
MIS=json.load(open(os.environ.get("MISFILE","miscues.json")));G=json.load(open(GF));keep=set(files[:N:step]) if step>1 else set(files[:N])
if os.environ.get("MISFILE"): keep=set(m["f"] for m in MIS[:N:step]);audio={}
def aud(f):
    if f not in audio:
        if f.startswith("/"):
            import subprocess
            a=np.frombuffer(subprocess.run(["ffmpeg","-v","quiet","-i",f,"-ar","16000","-ac","1","-f","f32le","-"],capture_output=True).stdout,np.float32).copy()
        else:
            cache=f"cache/{cond}_{f}.npy"
            if os.path.exists(cache): a=np.load(cache)
            else:
                a=load(f,cond);os.makedirs("cache",exist_ok=True);np.save(cache,a)
        if warp!=1.0:
            n=int(len(a)*warp);a=np.interp(np.linspace(0,len(a)-1,n),np.arange(len(a)),a).astype(np.float32)
        audio[f]=(np.clip(a,-1,1)*32767).astype(np.int16).tobytes()
    return audio[f]
for R,kc,ke,kn in cfgs:
    K={"x":R,"c":kc,"e":ke,"n":kn};out={};t0=time.time()
    for i,(mc,g) in enumerate(zip(MIS,G)):
        if mc["kind"] not in kinds or mc["f"] not in keep: continue
        ph=[g["phrase"]]*R
        for p,cls in g["vars"]: ph+=[p]*K[cls]
        ph+=["[unk]"]*UNK
        if GARB[0]:
            have=set(" ".join(ph[R:]).split())|set(g["phrase"].split());n=0
            for w in LEXW:
                if len(w)<3 or w in have: continue
                ph+=[w]*GARB[1];n+=1
                if n>=GARB[0]: break
        rec=vosk.KaldiRecognizer(VM,16000,json.dumps(ph,ensure_ascii=False));rec.SetWords(True);pcm=aud(mc["f"]);fin=[];times=[];tl=[];last=None
        for o in range(0,len(pcm),3200):
            if rec.AcceptWaveform(pcm[o:o+3200]):
                r=json.loads(rec.Result()).get("result",[]);fin+=[w["word"] for w in r];times+=[[w["word"],w["start"],w["end"]] for w in r];part=[]
            else: part=json.loads(rec.PartialResult()).get("partial","").split()
            cur=(len(fin),tuple(part))
            if cur!=last: last=cur;tl.append([round((o+3200)/32000/warp,2),len(fin),list(fin[len(tl[-1][2])-0:]) if False else None,list(part)])
        r=json.loads(rec.FinalResult()).get("result",[]);fin+=[w["word"] for w in r];times+=[[w["word"],w["start"],w["end"]] for w in r]
        tl.append([round(len(pcm)/32000/warp,2),len(fin),None,[]])
        out[i]={"fin":fin,"times":[[w,round(s/warp,2),round(e/warp,2)] for w,s,e in times],"tl":[[t,nf,p] for t,nf,_,p in tl]}
    tag=f"{cond}_R{R}_{kc}_{ke}_{kn}_w{warp}_u{UNK}_g{GARB[0]}x{GARB[1]}"
    json.dump(out,open(os.environ.get("OUT",f"hyp3_{tag}.json"),"w"),ensure_ascii=False)
    print("decoded",len(out),"in",round(time.time()-t0),"s ->",f"hyp3_{tag}.json",flush=True)
