# Test recordings for the stop-and-retry flow: a wrong word is spliced in before the right one (once, or three times).
import json,subprocess,numpy as np,re,wave,vosk
vosk.SetLogLevel(-1)
D=json.load(open("dict_de.json"))[0];R="/home/claude/pokelearn-lesen/"
def pcm(sr): return np.frombuffer(subprocess.run(["ffmpeg","-v","quiet","-i",R+D["file"],"-ar",str(sr),"-ac","1","-f","s16le","-"],capture_output=True).stdout,np.int16)
a16=pcm(16000);a48=pcm(48000)
words=[w for w in re.sub(r"[^a-zäöüß ]"," ",D["text"].lower()).split()]
M=vosk.Model("models/vosk_x/slim/model");rec=vosk.KaldiRecognizer(M,16000,json.dumps([" ".join(words),"[unk]"],ensure_ascii=False));rec.SetWords(True);res=[]
b=a16.tobytes()
for o in range(0,len(b),3200):
    if rec.AcceptWaveform(b[o:o+3200]): res+=json.loads(rec.Result()).get("result",[])
res+=json.loads(rec.FinalResult()).get("result",[])
res=res[:len(words)]
print([(w["word"],w["start"]) for w in res[10:20]])
def seg(w,pad=0.04): return a48[int((w["start"]-pad)*48000):int((w["end"]+pad)*48000)]
def find(word,n=0): return [w for w in res if w["word"]==word][n]
tgt=find("eine");i=res.index(tgt)
sil=lambda s: np.zeros(int(48000*s),np.int16)
def write(name,parts):
    x=np.concatenate([sil(2.5)]+parts+[sil(4)])
    with wave.open(name,"wb") as f: f.setnchannels(1);f.setsampwidth(2);f.setframerate(48000);f.writeframes(x.tobytes())
    print(name,round(len(x)/48000,1),"s")
head=a48[:int((tgt["start"]-0.03)*48000)];tail=a48[int((tgt["start"]-0.03)*48000):int((res[-1]["end"]+0.3)*48000)]
write("e2e/retry1.wav",[head,seg(find("hungrig")),sil(0.9),tail])
write("e2e/retry3.wav",[head,seg(find("hungrig")),sil(0.8),seg(find("bruder")),sil(0.8),seg(find("mittwoch")),sil(1.6),tail])
open("e2e/retry.txt","w").write(D["text"])
