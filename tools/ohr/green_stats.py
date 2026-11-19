import json,sys,statistics as st
def lat(run,al):
    r=json.loads(open(run).read().strip().splitlines()[-1]);out=[]
    for k,(w,g) in enumerate(zip(r["expN"],r["g"])):
        if g is None or k==len(r["expN"])-1:continue
        c=[e for (ww,s,e) in al if ww.replace("ß","ss")==w and e<=g+0.05]
        if c:out.append(g-max(c))
    return out,r["lagMed"],r["lagMax"]
for w,alf in [("a0","/tmp/al_a0.json"),("a0_child","/tmp/al_a0c.json")]:
    al=json.load(open(alf))
    for v in ["good","cand"]:
        L=[];lm=[];lx=[]
        for rep in (1,2):
            try:x,a,b=lat(f"/tmp/gr_{w}_{v}_{rep}.json",al);L+=x;lm.append(a);lx.append(b)
            except Exception as e:print(w,v,rep,"ERR",e)
        if L:
            L.sort();q=lambda f:L[min(len(L)-1,int(len(L)*f))]
            print(f"{w:9} {v}: green after word end median {q(.5):.3f}s p75 {q(.75):.3f}s p90 {q(.9):.3f}s (n={len(L)}) · lag median {lm} max {lx}")
