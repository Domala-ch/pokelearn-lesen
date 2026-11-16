// Judge-level bench for an open-vocabulary recognizer: transcripts + the app's own word judge.
const {chromium}=require('/tmp/claude-0/-home-claude/f07ee677-a41f-56b8-9810-2a87a0982a1a/scratchpad/node_modules/playwright');const fs=require('fs');
const HYP=process.argv[2],APP=process.argv[3]||"/home/claude/lernquest.html";
(async()=>{const b=await chromium.launch({args:["--disable-dev-shm-usage"]});const p=await b.newPage();p.on("pageerror",e=>console.log("ERR",e.message));
fs.writeFileSync("/tmp/evk_page.html",'<meta charset="utf-8">'+fs.readFileSync(APP,"utf8"));await p.goto("file:///tmp/evk_page.html");await p.waitForTimeout(800);
const hyp=Object.fromEntries(JSON.parse(fs.readFileSync(HYP)).map(x=>[x.f,x.hyp]));const MIS=JSON.parse(fs.readFileSync("miscues.json")).filter(m=>hyp[m.f]!=null);
const res=await p.evaluate(([MIS,hyp])=>{const out={};
 for(const m of MIS){lsStart({id:"x"+Math.random(),level:"mittel",title:"T",text:m.E.join(" ")+".",lang:"de",q:[["?",["a","b","c"]]]});LS.mode="mic";LS.phase="reading";LSLANG="de";LSSTRICT=true;
  const H=heardTokens(hyp[m.f]);const a=lsAlign(LS.expN,H,{});const st=LS.expN.map((w,k)=>a.st[k]||"none");
  const flags=[];st.forEach((s,k)=>{if(s==="bad"||s==="miss")flags.push(k)});
  const o=out[m.kind]||(out[m.kind]={tot:0,det:0,FA:0,W:0,ex:[]});
  if(m.kind==="correct"){o.FA+=flags.length;o.W+=m.E.length;if(o.ex.length<25)flags.forEach(k=>o.ex.push(LS.expN[k]+"←"+(a.mh[k]!=null?H[a.mh[k]][0]:"-")))}
  else{o.tot++;const hit=m.kind==="insert"?flags.some(k=>Math.abs(k-m.p)<=1):flags.includes(m.p);o.det+=hit?1:0;o.FA+=flags.filter(k=>Math.abs(k-m.p)>1).length;o.W+=m.E.length;if(!hit&&o.ex.length<5)o.ex.push(m.E[m.p]+"←said:"+m.S[m.p]+" st:"+st[m.p])}}
 return out},[MIS,hyp]);
for(const k of ["correct","closed","ending","near","gross","omit","insert"]){const o=res[k];if(!o)continue;
 if(k==="correct")console.log(`${HYP} correct: false flags ${o.FA}/${o.W} = ${(o.FA/o.W*100).toFixed(2)} per 100   e.g. ${o.ex.slice(0,14).join(" ")}`);
 else console.log(`${HYP} ${k}: detected ${o.det}/${o.tot} = ${(o.det/o.tot*100).toFixed(0)}%  false flags elsewhere ${(o.FA/o.W*100).toFixed(2)}/100  missed e.g. ${o.ex.slice(0,3).join(" | ")}`)}
await b.close()})();
