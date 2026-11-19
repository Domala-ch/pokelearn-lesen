// Streaming judge + consistency check: replays what the recognizer showed through the app's real reading logic and compares the
// final colours with the recognizer's own final transcript ("Ich höre" line):  GN = green although not heard,  RH = red although heard right.
const {chromium}=require('/tmp/claude-0/-home-claude/f07ee677-a41f-56b8-9810-2a87a0982a1a/scratchpad/node_modules/playwright');const fs=require('fs');
const APP=process.env.APP||"/home/claude/lernquest.html",GF=process.env.GRAMMARS||"grammars.json";
(async()=>{const b=await chromium.launch({args:["--disable-dev-shm-usage"]});const p=await b.newPage();p.on("pageerror",e=>console.log("ERR",e.message));
fs.writeFileSync("/tmp/sjudge_page.html",'<meta charset="utf-8">'+fs.readFileSync(APP,"utf8"));await p.goto("file:///tmp/sjudge_page.html");await p.waitForTimeout(800);
await p.evaluate(()=>{lsSayWord=()=>{};lsBeep=()=>{};toast=()=>{};window.__noalt=new Set();window.__simT=0;lsNow=()=>window.__simT;const st=window.setTimeout;window.setTimeout=(f,ms)=>0});
const MIS=JSON.parse(fs.readFileSync(process.env.MISFILE||"miscues.json")),G=JSON.parse(fs.readFileSync(GF)),GEN=JSON.parse(fs.readFileSync("mls/gender.json"));const gOf=f=>GEN[f.split("/").pop().split("_")[0]]||(/-m-/.test(f)?"M":"F");
for(const HYP of process.argv.slice(2)){const hyp=JSON.parse(fs.readFileSync(HYP));
 const corrTimes={};for(const i of Object.keys(hyp))if(MIS[i].kind==="correct")corrTimes[MIS[i].f]=hyp[i].times;
 const items=Object.keys(hyp).map(i=>({m:MIS[i],oov:G[i].oov,alias:G[i].alias||null,h:hyp[i],g:gOf(MIS[i].f),ct:corrTimes[MIS[i].f]||null}));
 const res=await p.evaluate(items=>{const out={};const U=w=>w==="[unk]"?"xxunkxx":w;
  for(const {m,oov,alias,h,g,ct} of items){lsStart({id:"x"+Math.random(),level:"mittel",title:"T",text:m.text||m.E.join(" ")+".",lang:"de",q:[["?",["a","b","c"]]]});const L=LS;L.mode="mic";L.phase="reading";L.srLive=true;L.eng="ohr";LSLANG="de";LSOOV=new Set(oov);
   if(alias){LSALIAS=new Map(Object.entries(alias).map(([k,v])=>[k,new Set(v)]))}else LSALIAS=new Map();L._subKey=null;if(window.lsEarMode)lsEarMode(L);
   const stops=new Map(),evs=[],gT=[];let fin=[],cur=null,heard=[];
   const TL=[];for(let q=0;q<h.tl.length;q++){TL.push(h.tl[q]);const nt=q+1<h.tl.length?h.tl[q+1][0]:h.tl[q][0]+.6;for(let x=h.tl[q][0]+.1;x<nt-.01;x+=.1)TL.push([Math.round(x*100)/100,h.tl[q][1],h.tl[q][2]])}
   for(const [t,nf,part] of TL){window.__simT=t*1000;fin=h.fin.slice(0,nf).map(U);const words=[...fin,...part.map(U)];L.srFin=fin;L.srFinN=fin.length;L.srAlt=words.map(()=>window.__noalt);L.srText=words.join(" ");
    heard=heardTokens(L.srText);try{lsAdvance(heard)}catch(e){out.err=(out.err||0)+1;out.errm=String(e&&e.stack||e).slice(0,300);break}
    if(L.retry&&!stops.has(L.retry.idx)){stops.set(L.retry.idx,t);cur={idx:L.retry.idx,t,heard:L.retry.key0};evs.push(cur)}
    for(let k=0;k<L.expN.length;k++){if(gT[k]==null){const s2=L.retry&&k===L.retry.idx?"retry":(k<L.e0?L.fin[k]:L.wst[k]);if(s2==="ok"||s2==="fixed")gT[k]=t}}
    if(cur&&(!L.retry||L.retry.idx!==cur.idx)){cur.end=t;cur.out=L.fin[cur.idx]||L.wst[cur.idx];cur=null}}
   if(cur){cur.end=9e9;cur.out="open"}
   const N=L.expN.length,E=L.expN,Hn=heard.length;
   // reference: plain alignment of the final transcript with the text, exact words only
   const eq=(k,j)=>{const e=E[j],t=heard[k];if(t.includes(e)||t.some(a=>foldC(a)===foldC(e)))return true;if(t.includes("xxunkxx")&&LSOOV.has(e))return true;const al=LSALIAS.get(e);return!!(al&&t.some(a=>al.has(a)))};
   const cat=(k,n,j)=>{if(k+n>Hn)return false;const e=E[j],al=LSALIAS.get(e);let s="";for(let q=0;q<n;q++)s+=heard[k+q][0];return s===e||foldC(s)===foldC(e)||!!(al&&al.has(s))};
   const D=[],B=[];for(let i=0;i<=Hn;i++){D.push(new Float64Array(N+1));B.push(new Int8Array(N+1))}
   for(let i=0;i<=Hn;i++)for(let j=0;j<=N;j++){if(!i&&!j)continue;let best=1e9,bb=0;
     if(i>0&&D[i-1][j]+1<best){best=D[i-1][j]+1;bb=1}
     if(j>0&&D[i][j-1]+1<best){best=D[i][j-1]+1;bb=2}
     if(i>0&&j>0){const c=D[i-1][j-1]+(eq(i-1,j-1)?0:1.2);if(c<best){best=c;bb=eq(i-1,j-1)?3:4}}
     if(i>1&&j>0&&cat(i-2,2,j-1)&&D[i-2][j-1]<best){best=D[i-2][j-1];bb=5}
     if(i>2&&j>0&&cat(i-3,3,j-1)&&D[i-3][j-1]<best){best=D[i-3][j-1];bb=7}
     if(i>0&&j>1&&heard[i-1].some(a=>a===E[j-2]+E[j-1])&&D[i-1][j-2]<best){best=D[i-1][j-2];bb=6}
     D[i][j]=best;B[i][j]=bb}
   const M=new Array(N).fill(false),HW=new Array(N).fill(null);{let i=Hn,j=N;while(i>0||j>0){const bb=B[i][j];if(bb===1)i--;else if(bb===2)j--;else if(bb===3){M[j-1]=true;i--;j--}else if(bb===4){HW[j-1]=heard[i-1][0];i--;j--}else if(bb===5){M[j-1]=true;i-=2;j--}else if(bb===7){M[j-1]=true;i-=3;j--}else if(bb===6){M[j-1]=M[j-2]=true;i--;j-=2}else break}}
   if(m.kind==="correct"&&h.times){const gl=out.gl||(out.gl=[]);let q=0;for(let k=0;k<N;k++){let j=-1;for(let z=q;z<Math.min(h.times.length,q+3);z++)if(h.times[z][0].replace(/ß/g,"ss")===E[k]){j=z;break}if(j<0)continue;q=j+1;if(gT[k]!=null&&k<N-1)gl.push(gT[k]-h.times[j][2])}}
   const O=new Set(oov);const st=[...stops.keys()].filter(k=>!O.has(L.expN[k]));
   const stat=k=>L.retry&&k===L.retry.idx?"retry":(k<L.e0?L.fin[k]:L.wst[k]);
   for(const key of [m.kind,"all"]){const o=out[key]||(out[key]={tot:0,det:0,FS:0,W:0,lat:[],ex:[],soft:0,reach:0,GN:0,RH:0,gn:{},rh:{},gnx:[],rhx:[],nh:0,nhM:0,stat:{}});
    o.reach+=L.pos>=N-2?1:0;o.tot++;o.W+=N;
    for(let k=0;k<N;k++){const s=stat(k);o.stat[s]=(o.stat[s]||0)+1;if(O.has(E[k]))continue;const green=s==="ok"||s==="soft"||s==="fixed",red=s==="bad"||s==="miss"||s==="retry";
     if(s==="skip"){o.nh++;if(M[k])o.nhM++}
     if(green&&!M[k]&&k<L.pos){o.GN++;o.gn[s]=(o.gn[s]||0)+1;if(o.gnx.length<40)o.gnx.push(E[k]+"←"+(HW[k]||"∅")+"("+s+")")}
     if(red&&M[k]){o.RH++;o.rh[s]=(o.rh[s]||0)+1;if(o.rhx.length<40)o.rhx.push(E[k]+"("+s+")")}}
    if(key==="all")continue;
    if(m.kind==="correct"){o.FS+=st.length;for(const ev of evs){if(O.has(L.expN[ev.idx]))continue;const quick=ev.out==="ok"&&ev.end-ev.t<=.35;o.undone=(o.undone||0)+(ev.out==="ok"?1:0);o.quick=(o.quick||0)+(quick?1:0);if(o.ex.length<60)o.ex.push(L.expN[ev.idx]+"←"+ev.heard+(ev.out==="ok"?"(undone "+(ev.end-ev.t).toFixed(1)+"s)":"("+ev.out+")"))}}
    else{const near=m.kind==="insert"?st.some(k=>Math.abs(k-m.p)<=1):st.includes(m.p);const s=stat(m.p);const flagged=near||s==="bad"||s==="miss"||s==="skip";o.det+=near?1:0;o.flag=(o.flag||0)+(flagged?1:0);o.FS+=st.filter(k=>Math.abs(k-m.p)>1).length;
     if(near&&ct){const tStop=stops.get(m.p);let e=null;if(ct.length>m.p&&ct[m.p]&&ct[m.p][0].replace(/ß/g,"ss")===m.S[m.p])e=ct[m.p][2];else{const c=ct.filter(x=>x[0].replace(/ß/g,"ss")===m.S[m.p]);if(c.length===1)e=c[0][2]}if(e!=null&&tStop!=null)o.lat.push(tStop-e)}
     if(!near&&o.ex.length<10)o.ex.push(m.E[m.p]+"←"+(m.S[m.p]||"∅")+"("+(s||"-")+")")}}}
  return out},items);
 const pc=o=>o&&o.tot?(o.det/o.tot*100).toFixed(0).padStart(3)+"%":"  - ",pf=o=>o&&o.tot?((o.flag||0)/o.tot*100).toFixed(0).padStart(3)+"%":"  - ",fs_=o=>o?(o.FS/o.W*100).toFixed(2):"-";
 const lat=[].concat(...["closed","near","gross"].map(k=>(res[k]||{lat:[]}).lat)).sort((a,b)=>a-b),q=f=>lat.length?lat[Math.min(lat.length-1,Math.floor(lat.length*f))].toFixed(2):"-";
 const c=res.correct||{},a=res.all||{};
 console.log(`${HYP.replace("hyp3_","").replace(".json","").padEnd(34)} FS/100 ${fs_(c)} (self-corrected ${c.undone||0}/${c.FS}) end ${c.reach}/${c.tot} | caught(stop): closed ${pc(res.closed)} near ${pc(res.near)} gross ${pc(res.gross)} omit ${pc(res.omit)} (flag ${pf(res.omit)}) insert ${pc(res.insert)} | delay med ${q(.5)}s p90 ${q(.9)}s${res.err?" ERR "+res.err+" "+res.errm:""}`);
 {const g=(res.gl||[]).slice().sort((a,b)=>a-b),qq=f=>g.length?g[Math.min(g.length-1,Math.floor(g.length*f))].toFixed(2):"-";console.log(`   green after word end: median ${qq(.5)}s p75 ${qq(.75)}s p90 ${qq(.9)}s p97 ${qq(.97)}s (n=${g.length})`)}
 console.log(`   consistency over ${a.W} words: GREEN-not-heard ${(a.GN/a.W*100).toFixed(2)}/100 ${JSON.stringify(a.gn)} | RED-but-heard ${(a.RH/a.W*100).toFixed(2)}/100 ${JSON.stringify(a.rh)} | not-heard marks ${(a.nh/a.W*100).toFixed(2)}/100 (of these in transcript ${a.nhM}) | correct-reading: GN ${(c.GN/c.W*100).toFixed(2)} RH ${(c.RH/c.W*100).toFixed(2)} skip ${(c.nh/c.W*100).toFixed(2)} | status ${JSON.stringify(a.stat)}`);
 if(process.env.EX)console.log("   false stops at:",(c.ex||[]).join(" "),"\n   GN:",(a.gnx||[]).join(" "),"\n   RH:",(a.rhx||[]).join(" "),"\n   missed closed:",(res.closed||{ex:[]}).ex.join(" "),"\n   missed near:",(res.near||{ex:[]}).ex.join(" "),"\n   missed gross:",(res.gross||{ex:[]}).ex.join(" "),"\n   missed omit:",(res.omit||{ex:[]}).ex.join(" "))}
await b.close()})();
