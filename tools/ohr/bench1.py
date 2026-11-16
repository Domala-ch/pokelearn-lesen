import sys,json,os,re,subprocess,time,numpy as np
sys.path.insert(0,".")
from dec1 import mk,run
T=json.load(open("mls/transcripts.json"))
files=sorted(f for f in os.listdir("mls") if f.endswith(".flac"))
def load(f,cond):
    af={"clean":[],"child":["-af","asetrate=16000*1.26,aresample=16000,atempo=0.7937"],"child2":["-af","asetrate=16000*1.41,aresample=16000,atempo=0.7092"],"fast":["-af","atempo=1.2"],"noise":[]}[cond]
    raw=subprocess.run(["ffmpeg","-v","quiet","-i","mls/"+f,"-ar","16000","-ac","1"]+af+["-f","f32le","-"],capture_output=True).stdout
    a=np.frombuffer(raw,np.float32).copy()
    if cond=="noise":
        rng=np.random.default_rng(len(a));p=np.mean(a**2);a+=rng.normal(0,np.sqrt(p/10**(12/10)),a.size).astype(np.float32)   # 12 dB SNR white noise
    return a
def norm(s):
    s=s.lower().replace("ß","ss");s=re.sub(r"[^a-zäöüàâçéèêëîïôûùœ0-9' ]"," ",s);return s.split()
def wer(r,h):
    d=np.zeros((len(r)+1,len(h)+1),int);d[:,0]=range(len(r)+1);d[0,:]=range(len(h)+1)
    for i in range(1,len(r)+1):
        for j in range(1,len(h)+1): d[i,j]=min(d[i-1,j]+1,d[i,j-1]+1,d[i-1,j-1]+(r[i-1]!=h[j-1]))
    return d[-1,-1]
if __name__=="__main__":
    eng=sys.argv[1];conds=sys.argv[2].split(",");N=int(sys.argv[3]) if len(sys.argv)>3 else 999
    if eng=="kroko": rec=mk()
    else:
        from faster_whisper import WhisperModel;wm=WhisperModel(eng,device="cpu",compute_type="int8")
    out={}
    for c in conds:
        E=W=0;tt=0;dur=0;res=[]
        for f in files[:N]:
            a=load(f,c);ref=norm(T[f[:-5]])
            t=time.time()
            if eng=="kroko": hyp,_,_=run(rec,a)
            else:
                segs,_=wm.transcribe(a,language="de",beam_size=1,condition_on_previous_text=False);hyp=" ".join(s.text for s in segs)
            tt+=time.time()-t;dur+=len(a)/16000
            e=wer(ref,norm(hyp));E+=e;W+=len(ref);res.append({"f":f,"ref":T[f[:-5]],"hyp":hyp})
        print(eng,c,f"WER {E/W*100:.1f}%  words {W}  rtf {tt/dur:.3f}",flush=True)
        json.dump(res,open(f"hyp_{eng}_{c}.json","w"),ensure_ascii=False)
