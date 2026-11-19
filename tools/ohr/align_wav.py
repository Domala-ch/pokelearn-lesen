# word end times of a recording (offline, the recognizer knows the text): align_wav.py <wav> <text> → JSON list [word,start,end]
import sys,json,re,subprocess,numpy as np,vosk;vosk.SetLogLevel(-1)
wav,text=sys.argv[1],sys.argv[2]
words=[w for w in re.sub(r"[^a-zäöüß0-9 ]"," ",text.lower()).split()]
a=subprocess.run(["ffmpeg","-v","quiet","-i",wav,"-ar","16000","-ac","1","-f","s16le","-"],capture_output=True).stdout
M=vosk.Model("models/vosk_x/slim/model");rec=vosk.KaldiRecognizer(M,16000,json.dumps([" ".join(words),"[unk]"]+sorted(set(words)),ensure_ascii=False));rec.SetWords(True);res=[]
for o in range(0,len(a),3200):
    if rec.AcceptWaveform(a[o:o+3200]):res+=json.loads(rec.Result()).get("result",[])
res+=json.loads(rec.FinalResult()).get("result",[])
print(json.dumps([[w["word"],w["start"],w["end"]] for w in res],ensure_ascii=False))
