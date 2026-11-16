// PokeLearn-Ohr: choice of the recognizer and the fallbacks (mock of the device recognizer, no sound)
const {chromium}=require("playwright");
(async()=>{const b=await chromium.launch({args:["--disable-dev-shm-usage","--use-fake-ui-for-media-stream","--use-fake-device-for-media-stream"]});
const T=(n,ok,x)=>console.log((ok?"PASS":"FAIL")+" "+n+(x?" – "+x:""));
const mk=async(state,routes)=>{const ctx=await b.newContext({viewport:{width:390,height:844},permissions:["microphone"]});
 await ctx.addInitScript(st=>localStorage.setItem("lernquest.v1",JSON.stringify(Object.assign({name:"Leo",grade:6,gradeSet:true,region:"ost",deck:[],wishes:[],progress:{},cards:{},history:{},coins:10,pin:"1234"},st))),state||{});
 await ctx.addInitScript(`window.__srInst=[];class SR{constructor(){window.__srInst.push(this)}start(){this.started=1}stop(){}abort(){}}window.webkitSpeechRecognition=SR;window.SpeechRecognition=SR;`);
 const p=await ctx.newPage();p.on("pageerror",e=>console.log("PAGEERR",e.message));await p.route("**/fonts.googleapis.com/**",r=>r.abort());if(routes)await routes(p);
 await p.goto("http://localhost:8770/index.html");await p.waitForTimeout(1200);await p.evaluate(()=>{const e=document.getElementById("standSheet");if(e)e.remove()});return{ctx,p}};
const read=p=>p.evaluate(()=>{showView("lesen");lsStart({id:"f"+Math.random(),level:"mittel",title:"T",text:"Am Morgen gehen die Kinder in den Wald.",lang:"de",q:[["?",["a","b","c"]]]})});
// 1) first time: the ear is not loaded yet → the device recognizer listens now, the ear loads for next time
{const {ctx,p}=await mk();await read(p);await p.click("button[data-la=mic]");await p.waitForTimeout(300);
 T("not loaded yet: device recognizer listens",await p.evaluate(()=>window.__srInst.length===1&&!!LS.sr&&LS.eng===""));
 T("… and the ear starts loading",await p.evaluate(()=>OHR.st==="loading"||OHR.st==="ready"));
 await p.waitForFunction(()=>OHR.st==="ready",null,{timeout:60000});
 await p.click("[data-la=micExit]").catch(()=>{});await read(p);const n=await p.evaluate(()=>window.__srInst.length);await p.click("button[data-la=mic]");await p.waitForTimeout(1500);
 T("next reading: the ear listens (no device recognizer)",await p.evaluate(n=>LS.eng==="ohr"&&!!LS.ohr&&LS.srLive&&!LS.sr&&window.__srInst.length===n,n),await p.evaluate(()=>JSON.stringify({eng:LS.eng,ohr:!!LS.ohr,live:LS.srLive})));
 T("status in the strip: listening",await p.evaluate(()=>/Ich höre/.test(document.getElementById("lsHow").textContent)));
 await p.click("[data-la=micClear]");await p.waitForTimeout(300);T("Neu beginnen keeps the ear running",await p.evaluate(()=>!!LS.ohr&&!!LS.ohr.rec&&LS.pos===0));
 await p.click("[data-la=micExit]");await p.waitForTimeout(200);T("leaving stops the microphone",await p.evaluate(()=>!LS.ohr));await ctx.close()}
// 2) parent chose the device recognizer
{const {ctx,p}=await mk({lsEngine:"dev"});await p.evaluate(()=>showView("lesen"));await p.waitForTimeout(300);
 T("choice «Gerät»: ear not loaded",await p.evaluate(()=>OHR.st==="idle"));T("device row visible, ear row hidden",await p.evaluate(()=>!document.getElementById("lsDevRow").hidden&&document.getElementById("lsEarRow").hidden));
 await p.selectOption("#lsEng","ohr");await p.waitForTimeout(200);T("switching to the ear: saved, rows swap, loading starts",await p.evaluate(()=>S.lsEngine==="ohr"&&document.getElementById("lsDevRow").hidden&&!document.getElementById("lsEarRow").hidden&&OHR.st!=="idle"));
 await p.selectOption("#lsEar","2");T("strictness saved",await p.evaluate(()=>S.lsStrictEar===2&&ohrOpts().kc===20));await ctx.close()}
// 3) the model cannot be loaded → message, device recognizer is used
{const {ctx,p}=await mk({},async p=>{await p.route("**/ohr/de-model.tar.gz",r=>r.fulfill({status:404,body:"no"}))});
 await p.evaluate(()=>showView("lesen"));const t0=Date.now();await p.waitForFunction(()=>OHR.st==="failed"||OHR.st==="ready",null,{timeout:200000}).catch(()=>{});
 T("load failure noticed",await p.evaluate(()=>OHR.st==="failed"),await p.evaluate(()=>OHR.st+" / "+OHR.err)+" after "+Math.round((Date.now()-t0)/1000)+"s");
 T("status line explains",await p.evaluate(()=>/nicht verfügbar/.test((document.getElementById("lsEngSt")||{}).textContent||"")));
 await read(p);await p.click("button[data-la=mic]");await p.waitForTimeout(300);T("reading works with the device recognizer",await p.evaluate(()=>!!LS.sr&&LS.eng===""));await ctx.close()}
await b.close()})();
