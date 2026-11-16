// Streaming judge for the bench: replays what the recognizer showed, step by step, through the app's real reading logic
// (instant judging, stop on a misread word). Reports false stops on correct reading, caught misreadings and how fast.
const {chromium}=require('/tmp/claude-0/-home-claude/f07ee677-a41f-56b8-9810-2a87a0982a1a/scratchpad/node_modules/playwright');const fs=require('fs');
const APP=process.env.APP||"/home/claude/lernquest.html",GF=process.env.GRAMMARS||"grammars.json";
(async()=>{const b=await chromium.launch({args:["--disable-dev-shm-usage"]});const p=await b.newPage();p.on("pageerror",e=>console.log("ERR",e.message));
fs.writeFileSync("/tmp/sjudge_page.html",'<meta charset="utf-8">'+fs.readFileSync(APP,"utf8"));await p.goto("file:///tmp/sjudge_page.html");await p.waitForTimeout(800);
await p.evaluate(()=>{lsSayWord=()=>{};lsBeep=()=>{};toast=()=>{};window.__noalt=new Set();window.__simT=0;lsNow=()=>window.__simT;const st=window.setTimeout;window.setTimeout=(f,ms)=>0});
const MIS=JSON.parse(fs.readFileSync(process.env.MISFILE||"miscues.json")),G=JSON.parse(fs.readFileSync(GF)),GEN=JSON.parse(fs.readFileSync("mls/gender.json"));const gOf=f=>GEN[f.split("/").pop().split("_")[0]]||(/-m-/.test(f)?"M":"F");
for(const HYP of process.argv.slice(2)){const hyp=JSON.parse(fs.readFileSync(HYP));
 // end time of each spoken word, from the run where the text was the spoken one
 const corrTimes={};for(const i of Object.keys(hyp))if(MIS[i].kind==="correct")corrTimes[MIS[i].f]=hyp[i].times;
 const items=Object.keys(hyp).map(i=>({m:MIS[i],oov:G[i].oov,h:hyp[i],g:gOf(MIS[i].f),ct:corrTimes[MIS[i].f]||null}));
 const res=await p.evaluate(items=>{const out={};const U=w=>w==="[unk]"?"xxunkxx":w;
  for(const {m,oov,h,g,ct} of items){lsStart({id:"x"+Math.random(),level:"mittel",title:"T",text:m.text||m.E.join(" ")+".",lang:"de",q:[["?",["a","b","c"]]]});const L=LS;L.mode="mic";L.phase="reading";L.srLive=true;L.eng="ohr";LSLANG="de";LSOOV=new Set(oov);L._subKey=null;
   const stops=new Map(),evs=[];let fin=[],fi=0,cur=null;
   const TL=[];for(let q=0;q<h.tl.length;q++){TL.push(h.tl[q]);const nt=q+1<h.tl.length?h.tl[q+1][0]:h.tl[q][0]+.6;for(let x=h.tl[q][0]+.1;x<nt-.01;x+=.1)TL.push([Math.round(x*100)/100,h.tl[q][1],h.tl[q][2]])}
   for(const [t,nf,part] of TL){window.__simT=t*1000;fin=h.fin.slice(0,nf).map(U);const words=[...fin,...part.map(U)];L.srFin=fin;L.srFinN=fin.length;L.srAlt=words.map(()=>window.__noalt);L.srText=words.join(" ");
    try{lsAdvance(heardTokens(L.srText))}catch(e){out.err=(out.err||0)+1;break}
    if(L.retry&&!stops.has(L.retry.idx)){stops.set(L.retry.idx,t);cur={idx:L.retry.idx,t,heard:L.retry.key0};evs.push(cur)}
    if(cur&&(!L.retry||L.retry.idx!==cur.idx)){cur.end=t;cur.out=L.fin[cur.idx];cur=null}}
   if(cur){cur.end=9e9;cur.out="open"}
   const N=L.expN.length,bad=[];for(let k=0;k<N;k++)if(L.fin[k]==="bad"||L.wst[k]==="bad"||L.wst[k]==="miss")bad.push(k);
   const O=new Set(oov);const st=[...stops.keys()].filter(k=>!O.has(L.expN[k]));
   for(const key of [m.kind,m.kind+"/"+g]){const o=out[key]||(out[key]={tot:0,det:0,FS:0,W:0,lat:[],ex:[],soft:0,reach:0});
    o.soft+=L.wst.filter(x=>x==="soft").length;o.reach+=L.pos>=N-2?1:0;
    if(m.kind==="correct"){o.FS+=st.length;o.W+=N;o.tot++;for(const ev of evs){if(O.has(L.expN[ev.idx]))continue;const quick=ev.out==="ok"&&ev.end-ev.t<=.35;o.undone=(o.undone||0)+(ev.out==="ok"?1:0);o.quick=(o.quick||0)+(quick?1:0);if(o.ex.length<60)o.ex.push(L.expN[ev.idx]+"←"+ev.heard+(ev.out==="ok"?"(undone "+(ev.end-ev.t).toFixed(1)+"s)":"("+ev.out+")"))}}
    else{o.tot++;const near=m.kind==="insert"?st.some(k=>Math.abs(k-m.p)<=1):st.includes(m.p);o.det+=near?1:0;o.FS+=st.filter(k=>Math.abs(k-m.p)>1).length;o.W+=N;
     if(near&&ct){const tStop=stops.get(m.p);let e=null;if(ct.length>m.p&&ct[m.p]&&ct[m.p][0].replace(/ß/g,"ss")===m.S[m.p])e=ct[m.p][2];else{const c=ct.filter(x=>x[0].replace(/ß/g,"ss")===m.S[m.p]);if(c.length===1)e=c[0][2]}if(e!=null&&tStop!=null)o.lat.push(tStop-e)}
     if(!near&&o.ex.length<8)o.ex.push(m.E[m.p]+"←"+m.S[m.p]+"("+(L.wst[m.p]||L.fin[m.p]||"-")+")")}}}
  return out},items);
 const pc=o=>o&&o.tot?(o.det/o.tot*100).toFixed(0).padStart(3)+"%":"  - ",fs_=o=>o?(o.FS/o.W*100).toFixed(2):"-";
 const lat=[].concat(...["closed","near","gross"].map(k=>(res[k]||{lat:[]}).lat)).sort((a,b)=>a-b),q=f=>lat.length?lat[Math.min(lat.length-1,Math.floor(lat.length*f))].toFixed(2):"-";
 const c=res.correct||{};
 console.log(`${HYP.replace("hyp3_","").replace(".json","").padEnd(30)} false stops/100 ${fs_(c)} (M ${fs_(res["correct/M"])} F ${fs_(res["correct/F"])}) of these corrected by the recognizer itself ${c.undone||0} (within 0.35s: ${c.quick||0}) of ${c.FS} | reached end ${c.reach}/${c.tot} soft ${(c.soft/c.W*100).toFixed(2)}/100 | caught: closed ${pc(res.closed)} near ${pc(res.near)} gross ${pc(res.gross)} ending ${pc(res.ending)} | delay median ${q(.5)}s p90 ${q(.9)}s (n=${lat.length})${res.err?" ERR "+res.err:""}`);
 if(process.env.EX)console.log("   false stops at:",(c.ex||[]).join(" "),"\n   missed closed:",(res.closed||{ex:[]}).ex.join(" "),"\n   missed near:",(res.near||{ex:[]}).ex.join(" "),"\n   missed gross:",(res.gross||{ex:[]}).ex.join(" "))}
await b.close()})();
