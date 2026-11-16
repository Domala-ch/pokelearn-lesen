// PokeLearn-Ohr: safety net – after two aborted loads the ear stays off on this device; choosing it again re-arms it
const {chromium}=require("playwright");
(async()=>{const b=await chromium.launch({args:["--disable-dev-shm-usage"]});const T=(n,ok,x)=>console.log((ok?"PASS":"FAIL")+" "+n+(x?" – "+x:""));
const ctx=await b.newContext({viewport:{width:390,height:844}});
await ctx.addInitScript(()=>{if(!sessionStorage.getItem("seeded")){sessionStorage.setItem("seeded","1");localStorage.setItem("lernquest.v1",JSON.stringify({name:"Leo",grade:6,gradeSet:true,region:"ost",deck:[],wishes:[],progress:{},cards:{},history:{},coins:10,pin:"1234"}));localStorage.setItem("pl-ohr-guard",JSON.stringify({n:1,on:1,t:Date.now()}))}});
await ctx.addInitScript(`window.__srInst=[];class SR{constructor(){window.__srInst.push(this)}start(){}stop(){}abort(){}}window.webkitSpeechRecognition=SR;window.SpeechRecognition=SR;`);
const p=await ctx.newPage();p.on("pageerror",e=>console.log("PAGEERR",e.message));await p.route("**/fonts.googleapis.com/**",r=>r.abort());
await p.goto("http://localhost:8770/index.html");await p.waitForTimeout(1200);await p.evaluate(()=>{const e=document.getElementById("standSheet");if(e)e.remove();showView("lesen")});await p.waitForTimeout(400);
T("second abort in a row: ear stays off",await p.evaluate(()=>OHR.blocked&&OHR.st==="failed"),await p.evaluate(()=>OHR.err+" | "+localStorage.getItem("pl-ohr-guard")));
T("status explains",await p.evaluate(()=>/abgebrochen/.test(document.getElementById("lsEngSt").textContent)),await p.evaluate(()=>document.getElementById("lsEngSt").textContent.slice(-110)));
await p.evaluate(()=>lsStart({id:"g1",level:"mittel",title:"T",text:"Am Morgen gehen die Kinder in den Wald.",lang:"de",q:[["?",["a","b","c"]]]}));await p.click("button[data-la=mic]");await p.waitForTimeout(300);
T("reading works with the device recognizer",await p.evaluate(()=>!!LS.sr&&LS.eng===""));
await p.click("[data-la=micExit]");await p.evaluate(()=>{lsStop();LS=null;showView("lesen")});await p.waitForTimeout(400);
await p.selectOption("#lsEng","dev");await p.selectOption("#lsEng","ohr");await p.waitForFunction(()=>OHR.st==="ready",null,{timeout:90000}).catch(()=>{});
T("choosing the ear again loads it",await p.evaluate(()=>OHR.st==="ready"&&!OHR.blocked&&!localStorage.getItem("pl-ohr-guard")),await p.evaluate(()=>OHR.st+" "+localStorage.getItem("pl-ohr-guard")));
// a normal first load leaves no mark
const c2=await b.newContext();await c2.addInitScript(()=>localStorage.setItem("lernquest.v1",JSON.stringify({name:"Leo",grade:6,gradeSet:true,region:"ost",deck:[],wishes:[],progress:{},cards:{},history:{},coins:10,pin:"1234"})));
const q=await c2.newPage();await q.goto("http://localhost:8770/index.html");await q.waitForTimeout(1000);const during=await q.evaluate(()=>{OHR.load();return localStorage.getItem("pl-ohr-guard")});await q.evaluate(()=>OHR.p);
T("guard armed while loading, lifted when ready",/"on":1/.test(during||"")&&await q.evaluate(()=>OHR.st==="ready"&&!localStorage.getItem("pl-ohr-guard")),during);
await b.close()})();
