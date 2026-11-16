import json,random,sys
sys.argv=["x"]
import rg
rng=random.Random(11);out=[]
for f in rg.files:
    S=[rg.key(w) for w in rg.norm(rg.T[f[:-5]])]
    out.append({"f":f,"kind":"correct","E":S,"p":None,"S":S})
    for kind in ["closed","ending","near","gross","omit","insert"]:
        E,p=rg.miscue(S,kind,rng)
        if E: out.append({"f":f,"kind":kind,"E":E,"p":p,"S":S})
json.dump(out,open("miscues.json","w"),ensure_ascii=False)
import collections;print(collections.Counter(x["kind"] for x in out))
