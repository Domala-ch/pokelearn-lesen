// debug one bench item: timeline of what the recognizer showed and how the words were judged
const {chromium}=require('/tmp/claude-0/-home-claude/f07ee677-a41f-56b8-9810-2a87a0982a1a/scratchpad/node_modules/playwright');const fs=require('fs');
const APP=process.env.APP||"/home/claude/lernquest.html",GF=process.env.GRAMMARS||"grammars.json";
(async()=>{const b=await chromium.launch({args:["--disable-dev-shm-usage"]});const p=await b.newPage();p.on("pageerror",e=>console.log("ERR",e.message));
fs.writeFileSync("/tmp/sjudge_page.html",'<meta charset="utf-8">'+fs.readFileSync(APP,"utf8"));await p.goto("file:///tmp/sjudge_page.html");await p.waitForTimeout(800);
await p.evaluate(()=>{lsSayWord=()=>{};lsBeep=()=>{};toast=()=>{};window.__noalt=new Set();window.__simT=0;lsNow=()=>window.__simT;window.setTimeout=(f,ms)=>0});
const MIS=JSON.parse(fs.readFileSync(process.env.MISFILE||"miscues.json")),G=JSON.parse(fs.readFileSync(GF));
const hyp=JSON.parse(fs.readFileSync(process.argv[2]));const want=process.argv[3],word=process.argv[4];
const ids=Object.keys(hyp).filter(i=>want.includes(":")?(MIS[i].kind===want.split(":")[0]&&MIS[i].p!=null&&MIS[i].E[MIS[i].p]===want.split(":")[1]):i===want);
for(const i of ids.slice(0,+(process.env.MAXN||2))){const m=MIS[i],h=hyp[i];
 const log=await p.evaluate(({m,oov,alias,h})=>{const U=w=>w==="[unk]"?"xxunkxx":w,log=[];lsStart({id:"x"+Math.random(),level:"mittel",title:"T",text:m.text||m.E.join(" ")+".",lang:"de",q:[["?",["a","b","c"]]]});const L=LS;L.mode="mic";L.phase="reading";L.srLive=true;L.eng="ohr";LSLANG="de";LSOOV=new Set(oov);LSALIAS=new Map(Object.entries(alias||{}).map(([k,v])=>[k,new Set(v)]));L._subKey=null;if(window.lsEarMode)lsEarMode(L);
  const TL=[];for(let q=0;q<h.tl.length;q++){TL.push(h.tl[q]);const nt=q+1<h.tl.length?h.tl[q+1][0]:h.tl[q][0]+.6;for(let x=h.tl[q][0]+.1;x<nt-.01;x+=.1)TL.push([Math.round(x*100)/100,h.tl[q][1],h.tl[q][2]])}
  let last="";for(const [t,nf,part] of TL){window.__simT=t*1000;const fin=h.fin.slice(0,nf).map(U);const words=[...fin,...part.map(U)];L.srFin=fin;L.srFinN=fin.length;L.srAlt=words.map(()=>window.__noalt);L.srText=words.join(" ");
   lsAdvance(heardTokens(L.srText));const st=L.expN.map((w,k)=>{const s=L.retry&&k===L.retry.idx?"RETRY"+L.retry.tries+"+"+L.retry.am:(k<L.e0?L.fin[k]:L.wst[k]);return s&&s!=="ok"?w+":"+s:null}).filter(Boolean).join(" ");
   const line=`heard[${fin.length}f]: …${words.slice(-7).join(" ")} | pos ${L.pos} e0 ${L.e0} h0 ${L.h0} | ${st}`;if(line!==last){log.push(t.toFixed(2)+" "+line);last=line}}
  return log},{m,oov:G[i].oov,alias:G[i].alias,h});
 console.log("#"+i,m.kind,"p="+m.p,"E:",m.E.map((w,k)=>k===m.p?"["+w+"]":w).join(" "),"\n   S:",m.S.join(" "));console.log(log.join("\n"))}
await b.close()})();
