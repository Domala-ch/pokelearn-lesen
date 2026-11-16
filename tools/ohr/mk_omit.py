# Test recordings: a word is left out (cut from the recording) — once the reader simply reads on, once she goes back and reads it.
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
res+=json.loads(rec.FinalResult()).get("result",[]);res=res[:len(words)]
def find(word,n=0): return [w for w in res if w["word"]==word][n]
sil=lambda s: np.zeros(int(48000*s),np.int16)
def cut(t0,t1): return a48[int(t0*48000):int(t1*48000)]
def write(name,parts):
    x=np.concatenate([sil(2.5)]+parts+[sil(4)])
    with wave.open(name,"wb") as f: f.setnchannels(1);f.setsampwidth(2);f.setframerate(48000);f.writeframes(x.tobytes())
    print(name,round(len(x)/48000,1),"s")
w=find("badehose");i=res.index(w);end=res[-1]["end"]+.3
print([(x["word"],x["start"],x["end"]) for x in res[i-2:i+4]])
# 1) «Badehose» left out, reading simply goes on
write("e2e/omit1.wav",[cut(0,w["start"]-.02),cut(w["end"]+.02,end)])
# 2) left out, two words on («ein Tuch»), then back: «meine Badehose, ein Tuch und …»
write("e2e/omit_back.wav",[cut(0,w["start"]-.02),cut(w["end"]+.02,res[i+2]["end"]+.05),sil(1.6),cut(res[i-1]["start"]-.05,end)])
