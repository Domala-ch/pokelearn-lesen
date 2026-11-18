// Replays a recording's timeline (what the ear wrote, moment by moment) through the CURRENT reading logic of the app and compares the
// result with what the app decided on the device.   node rec_replay.js <zip> [app.html]
// Use it to check a change of the comparison against real readings before it goes out.
const {chromium}=require("/tmp/claude-0/-home-claude/f07ee677-a41f-56b8-9810-2a87a0982a1a/scratchpad/node_modules/playwright");const fs=require("fs"),zlib=require("zlib");
function unzip(buf){const out={};let o=0;while(buf.readUInt32LE(o)===0x04034b50){const m=buf.readUInt16LE(o+8),cs=buf.readUInt32LE(o+18),nl=buf.readUInt16LE(o+26),xl=buf.readUInt16LE(o+28),name=buf.slice(o+30,o+30+nl).toString();const d=buf.slice(o+30+nl+xl,o+30+nl+xl+cs);out[name]=m===8?zlib.inflateRawSync(d):d;o+=30+nl+xl+cs}return out}
(async()=>{const files=unzip(fs.readFileSync(process.argv[2])),APP=process.argv[3]||"/home/claude/lernquest.html";
const infos=Object.keys(files).filter(n=>n.endsWith("info.json")).map(n=>JSON.parse(files[n].toString()));
const b=await chromium.launch({args:["--disable-dev-shm-usage"]});const p=await b.newPage();p.on("pageerror",e=>console.log("PAGEERR",e.message));
fs.writeFileSync("/tmp/rec_replay_page.html",'<meta charset="utf-8">'+fs.readFileSync(APP,"utf8"));await p.goto("file:///tmp/rec_replay_page.html");await p.waitForTimeout(800);
await p.evaluate(()=>{lsSayWord=()=>{};lsBeep=()=>{};toast=()=>{};window.__t=0;lsNow=()=>window.__t;window.setTimeout=()=>0});
for(const info of infos){const r=await p.evaluate(info=>{const NA=new Set();S.lsStrictEar=info.set.strict;S.lsMN=info.set.mn;
  lsStart({id:"rp"+Math.random(),level:"mittel",title:"T",text:info.text.text,lang:info.text.lang||"de",q:[["?",["a","b","c"]]]});const L=LS;L.mode="mic";L.phase="reading";L.srLive=true;L.eng="ohr";
  LSOOV=new Set(info.oov);LSALIAS=new Map(Object.entries(info.alias||{}).map(([k,v])=>[k,new Set(v)]));L._subKey=null;
  const hs=info.ev.filter(e=>e.e==="h"),stops=[];let seen=new Set();
  const step=(t,e)=>{window.__t=t*1000;const w=e.w?e.w.split(" "):[];L.srFin=w.slice(0,e.f);L.srFinN=e.f;L.srAlt=w.map(()=>NA);L.srText=w.join(" ");lsAdvance(heardTokens(L.srText));
   if(L.retry&&!seen.has(L.retry.idx)){seen.add(L.retry.idx);stops.push([t,L.retry.idx,L.retry.gap?1:0])}};
  for(let q=0;q<hs.length;q++){const e=hs[q],nt=q+1<hs.length?hs[q+1].t:e.t+3;for(let t=e.t;t<nt-.01;t+=.1)step(Math.round(t*100)/100,e)}
  const wst=L.expN.map((w,k)=>L.retry&&k===L.retry.idx?"bad":L.wst[k]||"");
  return{stops,wst,expN:L.expN}},info);
 const dev=new Map();for(const e of info.ev)if(e.e==="j"&&e.r&&!dev.has(e.r[0]))dev.set(e.r[0],e.t);
 const now=new Map(r.stops.map(s=>[s[1],s[0]]));
 console.log(`=== ${info.id} · ${info.who} · ${info.text.title} · Gerät ${dev.size} Stopps · jetzt ${now.size} Stopps`);
 for(const [i,t] of dev)if(!now.has(i))console.log(`   nur auf dem Gerät: «${r.expN[i]}» ${t.toFixed(1)}s`);
 for(const [i,t] of now)if(!dev.has(i))console.log(`   nur jetzt:          «${r.expN[i]}» ${t.toFixed(1)}s`);
 let d=0;for(let k=0;k<r.expN.length;k++){const a=info.wst[k]||"",c=r.wst[k]||"";if(a!==c&&!(["ok","fixed"].includes(a)&&["ok","fixed"].includes(c))){d++;if(d<=12)console.log(`   Wort «${r.expN[k]}»: Gerät ${a||"-"} · jetzt ${c||"-"}`)}}
 if(!d)console.log("   Farben gleich")}
await b.close()})();
