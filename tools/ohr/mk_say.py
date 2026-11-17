# Test recording from a synthetic voice (Thorsten VITS): parts of speech and pauses.  mk_say.py out.wav "text" 1.5 "text" ...
import sys,numpy as np,wave
from scipy.signal import resample_poly
from TTS.utils.synthesizer import Synthesizer
M="/tmp/claude-0/-home-claude/f07ee677-a41f-56b8-9810-2a87a0982a1a/scratchpad/models/tts_models--de--thorsten--vits/tts_models--de--thorsten--vits/"
syn=Synthesizer(tts_checkpoint=M+"model_file.pth",tts_config_path=M+"config.json");sr=syn.output_sample_rate
out=sys.argv[1];parts=[np.zeros(int(48000*2.5),np.int16)]
for a in sys.argv[2:]:
    try: parts.append(np.zeros(int(48000*float(a)),np.int16));continue
    except ValueError: pass
    w=np.array(syn.tts(a),np.float32);w=resample_poly(w,48000,sr);parts.append((np.clip(w/max(1e-6,np.abs(w).max())*.8,-1,1)*32767).astype(np.int16))
parts.append(np.zeros(48000*5,np.int16));x=np.concatenate(parts)
with wave.open(out,"wb") as f: f.setnchannels(1);f.setsampwidth(2);f.setframerate(48000);f.writeframes(x.tobytes())
print(out,round(len(x)/48000,1),"s")
