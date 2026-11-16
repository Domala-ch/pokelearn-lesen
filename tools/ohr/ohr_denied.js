// PokeLearn-Ohr ready, but the microphone is refused → device recognizer is tried, it is refused too → keyboard dictation is offered
const {chromium}=require("playwright");
(async()=>{const b=await chromium.launch({args:["--disable-dev-shm-usage","--use-fake-device-for-media-stream","--deny-permission-prompts"]});
const T=(n,ok,x)=>console.log((ok?"PASS":"FAIL")+" "+n+(x?" – "+x:""));
const ctx=await b.newContext({viewport:{width:390,height:844}});
await ctx.addInitScript(()=>localStorage.setItem("lernquest.v1",JSON.stringify({name:"Leo",grade:6,gradeSet:true,region:"ost",deck:[],wishes:[],progress:{},cards:{},history:{},coins:10,pin:"1234"})));
await ctx.addInitScript(`window.__srInst=[];class SR{constructor(){window.__srInst.push(this)}start(){setTimeout(()=>{this.onerror&&this.onerror({error:"not-allowed"});this.onend&&this.onend()},30)}stop(){}abort(){}}window.webkitSpeechRecognition=SR;window.SpeechRecognition=SR;`);
const p=await ctx.newPage();p.on("pageerror",e=>console.log("PAGEERR",e.message));await p.route("**/fonts.googleapis.com/**",r=>r.abort());
await p.goto("http://localhost:8770/index.html");await p.waitForTimeout(1200);await p.evaluate(()=>{const e=document.getElementById("standSheet");if(e)e.remove()});
T("ear loads",await p.evaluate(()=>OHR.load()));
await p.evaluate(()=>{showView("lesen");lsStart({id:"d1",level:"mittel",title:"T",text:"Am Morgen gehen die Kinder in den Wald.",lang:"de",q:[["?",["a","b","c"]]]})});await p.click("button[data-la=mic]");await p.waitForTimeout(1500);
const s=await p.evaluate(()=>({ohr:!!LS.ohr,eng:LS.eng,sr:window.__srInst.length,blocked:lsSRBlocked,ro:document.getElementById("lsDict").readOnly,how:document.getElementById("lsHow").textContent}));
T("microphone refused: ear stopped, device recognizer tried",!s.ohr&&s.sr>=1,JSON.stringify(s));
T("both refused: keyboard dictation offered, field editable",s.blocked&&s.ro===false&&!/Ich höre zu/.test(s.how),s.how.slice(0,80));
await b.close()})();
