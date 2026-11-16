// Judge-level results for the grammar recognizer: recognizer words + the app's own judge. usage: judge.js hyp2_x.json [...]
const {chromium}=require('/tmp/claude-0/-home-claude/f07ee677-a41f-56b8-9810-2a87a0982a1a/scratchpad/node_modules/playwright');const fs=require('fs');
const APP=process.env.APP||"/home/claude/lernquest.html";
(async()=>{const b=await chromium.launch({args:["--disable-dev-shm-usage"]});const p=await b.newPage();p.on("pageerror",e=>console.log("ERR",e.message));
fs.writeFileSync("/tmp/judge_page.html",'<meta charset="utf-8">'+fs.readFileSync(APP,"utf8"));await p.goto("file:///tmp/judge_page.html");await p.waitForTimeout(800);
const MIS=JSON.parse(fs.readFileSync("miscues.json")),G=JSON.parse(fs.readFileSync("grammars.json")),GEN=JSON.parse(fs.readFileSync("mls/gender.json"));
for(const HYP of process.argv.slice(2)){const hyp=JSON.parse(fs.readFileSync(HYP));
 const items=Object.keys(hyp).map(i=>({m:MIS[i],oov:G[i].oov,h:hyp[i].map(w=>w==="[unk]"?"xxunkxx":w).join(" "),g:GEN[MIS[i].f.split("_")[0]]}));
 const res=await p.evaluate(items=>{const out={};
  for(const {m,oov,h,g} of items){lsStart({id:"x"+Math.random(),level:"mittel",title:"T",text:m.E.join(" ")+".",lang:"de",q:[["?",["a","b","c"]]]});LS.mode="mic";LS.phase="reading";LSLANG="de";LSSTRICT=true;
   const H=heardTokens(h);const a=lsAlign(LS.expN,H,{});const st=LS.expN.map((w,k)=>a.st[k]||"none"),O=new Set(oov);
   const flags=[];st.forEach((s,k)=>{if((s==="bad"||s==="miss")&&!O.has(LS.expN[k]))flags.push(k)});
   for(const key of [m.kind,m.kind+"/"+g]){const o=out[key]||(out[key]={tot:0,det:0,FA:0,W:0,ex:[]});
    if(m.kind==="correct"){o.FA+=flags.length;o.W+=m.E.length;if(o.ex.length<30)flags.forEach(k=>o.ex.push(LS.expN[k]+"←"+(a.mh[k]!=null?H[a.mh[k]][0]:"-")))}
    else{o.tot++;const hit=m.kind==="insert"?flags.some(k=>Math.abs(k-m.p)<=1):flags.includes(m.p);o.det+=hit?1:0;o.FA+=flags.filter(k=>Math.abs(k-m.p)>1).length;o.W+=m.E.length;if(!hit&&o.ex.length<6)o.ex.push(m.E[m.p]+"←said:"+m.S[m.p]+"("+st[m.p]+")")}}}
  return out},items);
 const pc=(o)=>o?(o.det/o.tot*100).toFixed(0).padStart(3)+"%":"  - ";const fa=o=>o?(o.FA/o.W*100).toFixed(2):"-";
 console.log(`${HYP.replace("hyp2_","").replace(".json","").padEnd(34)} FA/100 ${fa(res.correct)} (M ${fa(res["correct/M"])} F ${fa(res["correct/F"])}) | closed ${pc(res.closed)} ending ${pc(res.ending)} near ${pc(res.near)} gross ${pc(res.gross)} insert ${pc(res.insert)} | F: closed ${pc(res["closed/F"])} near ${pc(res["near/F"])}`);
 if(process.env.EX)console.log("   FA e.g.:",res.correct.ex.join(" "),"\n   missed closed:",(res.closed||{ex:[]}).ex.join(" "),"\n   missed near:",(res.near||{ex:[]}).ex.join(" "))}
await b.close()})();
