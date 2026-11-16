"""Builds ohr/de-model.tar.gz and ohr/de-lex.txt from the official Vosk model.

Input:  vosk-model-small-de-0.15 (https://alphacephei.com/vosk/models, Apache-2.0), unpacked next to this script.
Output: model/ packed as de-model.tar.gz – without the built-in language model (the app builds a grammar per text):
        * graph/Gr.fst   → an empty acceptor (the original is 29 MB and never used with a grammar)
        * graph/words.txt → the word table that the original keeps inside Gr.fst
        * conf/model.conf → + --endpoint.rule5.min-utterance-length=60 (the default cuts a stretch of speech by force
          after 20 s, in the middle of a word; the app closes stretches itself at short breaths)
        de-lex.txt: the model's words sorted by frequency (wordfreq, CC BY-SA 4.0); first line = number of everyday words.
Needs: pip install kaldifst wordfreq
"""
import struct, os, shutil, tarfile, sys
import kaldifst
from wordfreq import zipf_frequency

SRC = sys.argv[1] if len(sys.argv) > 1 else "vosk-model-small-de-0.15"
OUT = sys.argv[2] if len(sys.argv) > 2 else "out"
dst = os.path.join(OUT, "model")
if os.path.exists(dst): shutil.rmtree(dst)
shutil.copytree(SRC, dst)

# word table from the header of the original Gr.fst (OpenFst binary: header, input symbols, output symbols)
d = open(os.path.join(SRC, "graph", "Gr.fst"), "rb").read(40_000_000); o = 0
def i32():
    global o; v = struct.unpack_from("<i", d, o)[0]; o += 4; return v
def i64():
    global o; v = struct.unpack_from("<q", d, o)[0]; o += 8; return v
def st():
    global o; n = i32(); s = d[o:o + n]; o += n; return s
i32(); st(); st(); i32(); flags = i32(); o += 8; i64(); i64(); i64()
assert flags & 1, "no symbol table in Gr.fst"
i32(); st(); i64(); size = i64(); ent = []
for _ in range(size):
    s = st(); k = i64(); ent.append((s.decode("utf8"), k))
ent.sort(key=lambda x: x[1])
seen = set(); lines = []
for s, k in ent:                      # the original table has one duplicated key (<s>, </s>)
    while k in seen: k -= 1
    seen.add(k); lines.append((s, k))
lines.sort(key=lambda x: x[1])
open(os.path.join(dst, "graph", "words.txt"), "w", encoding="utf8").write("".join(f"{s} {k}\n" for s, k in lines))

f = kaldifst.StdVectorFst(); s0 = f.add_state(); f.start = s0; f.set_final(s0, 0.0); f.write(os.path.join(dst, "graph", "Gr.fst"))
with open(os.path.join(dst, "conf", "model.conf"), "a") as c: c.write("--endpoint.rule5.min-utterance-length=60.0\n")
with tarfile.open(os.path.join(OUT, "de-model.tar.gz"), "w:gz", compresslevel=9) as t: t.add(dst, arcname="model")

ws = [s for s, _ in lines if s and not s.startswith(("<", "#", "!", "["))]
z = {w: zipf_frequency(w, "de") for w in ws}
ws.sort(key=lambda w: (-z[w], w))
nc = sum(1 for w in ws if z[w] >= 3.0); n25 = sum(1 for w in ws if z[w] >= 2.5)
open(os.path.join(OUT, "de-lex.txt"), "w", encoding="utf8").write(f"{nc} {n25}\n" + "\n".join(ws) + "\n")
print("model", os.path.getsize(os.path.join(OUT, "de-model.tar.gz")) // 1000, "kB;", len(ws), "words,", nc, "everyday")
