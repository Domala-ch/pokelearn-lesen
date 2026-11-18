// Words to listen to: recorded PokeLearn voice in the word list, game rounds and paper test; not recorded → PokeLearn voice on the device.
const {chromium}=require("playwright");
(async()=>{const b=await chromium.launch();let pass=0,fail=0;const T=(n,ok,x)=>{ok?pass++:fail++;console.log((ok?"PASS":"FAIL")+" "+n+(x?" – "+x:""))};
const ctx=await b.newContext({viewport:{width:390,height:844}});
await ctx.addInitScript(()=>{if(localStorage.getItem("lernquest.v1"))return;localStorage.setItem("lernquest.v1",JSON.stringify({name:"Dario",grade:6,gradeSet:true,region:"ost",wishes:[],progress:{},cards:{},history:{},coins:10,pin:"1234",dkVoices:{fr:{uri:"live-m"},en:{uri:"live-f"}},
 deck:[["le château","das Schloss"],["la gourde","die Trinkflasche"],["la forêt","der Wald"],["le garçon","der Junge"]].map(([f,d],i)=>({id:"f"+i,subj:"fr",type:"vocab",front:f,back:d,unit:"Unité 9",at:1}))}))});
const p=await ctx.newPage();p.on("pageerror",e=>console.log("PAGEERR",e.message));await p.route("**/ohr/**",r=>r.abort());await p.goto("http://localhost:8770/index.html");await p.waitForTimeout(1500);
await p.evaluate(async()=>{const e=document.getElementById("standSheet");if(e)e.remove();VIDX=await (await fetch("audio/v/index.json")).json();window.__log=[];
 recPlay=(f,seg)=>{__log.push("rec:"+f.split("/").pop());return Promise.resolve("ok")};liveSpeak=(t,l)=>{__log.push("live:"+l+":"+t);return Promise.resolve("ok")};speakDev=(t,l)=>{__log.push("dev:"+l+":"+t);return Promise.resolve("ok")};
 LIVE.ok=()=>true;LIVE.engine=()=>"wasm";LIVE.preload=()=>{};LIVE.warm=(it,l)=>__log.push("warm:"+l+":"+it[0])});
// built-in French list: recorded
const k=await p.evaluate(()=>Object.keys(FR)[0]);
await p.evaluate(k=>{const t=topicsFor("fr").find(t=>t.key===k);vocabSheet(t,k)},k);await p.waitForTimeout(200);await p.click('#vocabSheet [data-vs="say"][data-row="0"]');await p.waitForTimeout(200);
let L=await p.evaluate(()=>__log.splice(0));T("word list (PokeLearn list): plays the recorded voice",L.length===1&&/^rec:w-fr-m-/.test(L[0]),L.join(" "));
await p.evaluate(()=>document.getElementById("vocabSheet").remove());
// own photographed list: words are recorded where available, the others prepared by the on-device PokeLearn voice
await p.evaluate(()=>{const t=heftTopicsOf("fr")[0];vocabSheet(t,t.key)});await p.waitForTimeout(2500);L=await p.evaluate(()=>__log.splice(0));
const warmed=L.filter(x=>x.startsWith("warm:"));T("photographed list: unrecorded words are prepared ahead",warmed.length>=1,L.join(" "));
const rows=await p.evaluate(()=>[...document.querySelectorAll("#vocabSheet tbody tr")].map(r=>r.children[0].textContent));
for(let i=0;i<rows.length;i++){await p.click(`#vocabSheet [data-vs="say"][data-row="${i}"]`);await p.waitForTimeout(100)}
L=await p.evaluate(()=>__log.splice(0));T("photographed list: every word in the PokeLearn voice (recorded or on-device), never the device voice",L.length===rows.length&&L.every(x=>/^(rec|live):/.test(x)),L.join(" "));
await p.evaluate(()=>document.getElementById("vocabSheet").remove());
// game round
const r=await p.evaluate(k=>{let seen={say:0,after:0};for(let n=0;n<40;n++){const q=questionFor0("fr:"+k+":"+(n%5));if(q.say)seen.say++;if(q.sayAfter)seen.after++}return seen},k);
T("game round: the foreign word can be listened to (shown) or after answering",r.say>0&&r.after>0,JSON.stringify(r));
await p.evaluate(k=>{showView("spielen");R={subj:"fr",topic:{name:"x"},level:"leicht",seq:Array.from({length:6},(_,i)=>"fr:"+k+":"+i),i:0,correct:0,first:0,combo:0,best:0,coins:0,log:[]};show("play");
 let q;for(let n=0;n<30;n++){nextQ();q=R.q;if(q.say)break}},k);
T("game round: 🔊 next to the word",await p.evaluate(()=>!!document.getElementById("qSayW")));await p.click("#qSayW");await p.waitForTimeout(150);L=await p.evaluate(()=>__log.filter(x=>!x.startsWith("warm")).splice(-1));T("… plays the recorded voice",/^rec:/.test(L[0]||""),L.join(" "));
await p.evaluate(()=>{const q=R.q;answer(q.a[0],document.querySelector(".opt"))});await p.waitForTimeout(150);T("after answering: 🔊 with the word",await p.evaluate(()=>!!document.querySelector("[data-fbsay]")));
console.log(`\n${pass} passed, ${fail} failed`);await b.close()})();
