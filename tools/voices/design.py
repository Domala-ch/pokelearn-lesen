import time,torch,soundfile as sf,json
from qwen_tts import Qwen3TTSModel
torch.set_num_threads(2)
t=time.time();m=Qwen3TTSModel.from_pretrained("Qwen/Qwen3-TTS-12Hz-1.7B-VoiceDesign",device_map="cpu",dtype=torch.bfloat16);print("load",round(time.time()-t),flush=True)
print(m.model.get_supported_languages() if hasattr(m.model,"get_supported_languages") else "")
REF={"de":"Jeden Mittwoch gehen wir ins Hallenbad. Ich packe meine Badehose, ein Tuch und eine Flasche Wasser in die Tasche.",
     "fr":"Le matin, nous allons à l'école à vélo. Il fait beau, et les oiseaux chantent dans les arbres.",
     "en":"Every Saturday morning, my brother and I ride our bikes to the market. We buy fresh bread and apples."}
LN={"de":"German","fr":"French","en":"English"}
G={"f":"A warm, friendly female primary school teacher in her thirties","m":"A warm, calm male primary school teacher in his thirties"}
ACC={"de":"speaking clear standard High German (Hochdeutsch) with a light Swiss tone","fr":"speaking clear standard French","en":"speaking clear standard British English"}
for lang in ("de","fr","en"):
  for g in ("f","m"):
    ins=f"{G[g]}, {ACC[lang]}, reading a dictation to children: calm, natural, kind, every word articulated clearly, moderate pace."
    t=time.time();torch.manual_seed(7)
    w,sr=m.generate_voice_design(text=REF[lang],language=LN[lang],instruct=ins)
    sf.write(f"qw/ref_{lang}_{g}.wav",w[0],sr);print(lang,g,round(time.time()-t),"s for",round(len(w[0])/sr,1),flush=True)
json.dump(REF,open("qw/reftext.json","w"),ensure_ascii=False)
