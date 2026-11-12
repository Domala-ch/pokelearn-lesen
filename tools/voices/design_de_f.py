import time,torch,soundfile as sf,json
from qwen_tts import Qwen3TTSModel
torch.set_num_threads(2)
m=Qwen3TTSModel.from_pretrained("Qwen/Qwen3-TTS-12Hz-1.7B-VoiceDesign",device_map="cpu",dtype=torch.bfloat16)
REF=json.load(open("qw/reftext.json"))["de"]
C={
"A":"A warm, gentle and cheerful young woman in her late twenties with a soft, smiling voice, speaking clear standard High German. She reads a dictation to a 12-year-old child: friendly, encouraging, relaxed and natural, every word clearly articulated, moderate pace.",
"B":"A kind, warm female voice with a slightly low, velvety and calm timbre, like a beloved audiobook narrator for children. Clear standard German (Hochdeutsch), natural intonation, unhurried, every word crisp.",
"C":"A friendly mother in her thirties with a warm, bright and soft voice, smiling while she speaks. Clear German standard pronunciation, gentle and patient, natural rhythm, never robotic.",
"D":"Warm, soothing female radio presenter voice, mid-thirties, rich and pleasant tone, smiling and friendly. Speaks clear, natural standard German at a calm pace with precise articulation.",
"E":"A cheerful, warm-hearted primary school teacher, woman in her thirties, soft and melodic voice with a gentle smile. Clear Hochdeutsch, natural, lively but calm, each word pronounced clearly.",
}
for k,ins in C.items():
    for seed in (7,21):
        t=time.time();torch.manual_seed(seed)
        w,sr=m.generate_voice_design(text=REF,language="German",instruct=ins)
        sf.write(f"qw/de_f_{k}{seed}.wav",w[0],sr);print(k,seed,round(time.time()-t),flush=True)
