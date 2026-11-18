// Lese-Aufnahmen: parents' card (list, play, send, delete), start card (who reads), indicator while reading.
const {chromium}=require("playwright");
(async()=>{const b=await chromium.launch({args:["--disable-dev-shm-usage"]});let pass=0,fail=0;const T=(n,ok,x)=>{ok?pass++:fail++;console.log((ok?"PASS":"FAIL")+" "+n+(x?" – "+x:""))};
for(const scheme of ["light","dark"]){
const ctx=await b.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,colorScheme:scheme,acceptDownloads:true});
await ctx.addInitScript(()=>{if(!localStorage.getItem("lernquest.v1"))localStorage.setItem("lernquest.v1",JSON.stringify({name:"Dario",grade:6,gradeSet:true,region:"ost",deck:[],wishes:[],progress:{},cards:{},history:{},coins:10,pin:"1234",recOn:true}))});
const p=await ctx.newPage();p.on("pageerror",e=>console.log("PAGEERR",e.message));await p.route("**/fonts.googleapis.com/**",r=>r.abort());await p.route("**/ohr/**",r=>r.abort());
await p.goto("http://localhost:8770/index.html");await p.waitForTimeout(1300);await p.evaluate(()=>{const e=document.getElementById("standSheet");if(e)e.remove()});
await p.evaluate(async()=>{for(const [i,who,title,stops] of [[1,"kind","Mit Kompass und Karte durch den Wald",3],[2,"erw","Der Igel im Garten",0]]){const n=16000*(40+i*20),id="rt"+i;
  await LREC.put({id,at:Date.now()-i*3600e3,who,title,level:"mittel",sec:n/16000,words:139,pos:i===1?139:80,bad:2,stops,end:i===1?"fertig":"abgebrochen"},{wav:lrecWav([new Int16Array(n)],n),info:{v:1,id,who,at:new Date().toISOString(),text:{title,text:"x"},ev:[]}})}});
await p.evaluate(()=>showView("eltern"));await p.waitForTimeout(300);
for(const k of "1234")await p.click(`#pad [data-k="${k}"]`);await p.waitForTimeout(500);
const sum=p.locator("summary",{hasText:"Lese-Aufnahmen"});T(scheme+": card in the parents' area",await sum.count()===1);await sum.click();await p.waitForTimeout(600);
const card=p.locator("details.esec",{hasText:"Lese-Aufnahmen"});await card.scrollIntoViewIfNeeded();await card.screenshot({path:`qa/lrec_card_${scheme}.png`});
T(scheme+": two recordings listed, newest first",await p.evaluate(()=>[...document.querySelectorAll("#recList [data-rid]")].map(x=>x.dataset.rid).join(","))==="rt1,rt2");
T(scheme+": no horizontal overflow",!(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth)));
if(scheme==="light"){
 await p.click('[data-rid="rt1"] [data-rplay]');await p.waitForTimeout(300);T("play: audio player appears with the sound",await p.evaluate(()=>{const a=document.querySelector('[data-rid="rt1"] audio');return!a.hidden&&a.src.startsWith("blob:")}));
 await p.selectOption('[data-rid="rt2"] [data-rwho]',"kind");await p.waitForTimeout(200);T("who reads can be corrected",(await p.evaluate(async()=>(await LREC.list()).find(m=>m.id==="rt2").who))==="kind");
 const [dl]=await Promise.all([p.waitForEvent("download",{timeout:8000}),p.click('[data-rid="rt1"] [data-rsend]')]);const path=await dl.path();
 const z=require("fs").readFileSync(path);T("send: a zip with audio.wav and info.json",z.readUInt32LE(0)===0x04034b50&&z.includes(Buffer.from("audio.wav"))&&z.includes(Buffer.from("info.json")),dl.suggestedFilename());
 await p.click('[data-rid="rt2"] [data-rdel]');await p.waitForTimeout(400);T("delete one",await p.evaluate(()=>document.querySelectorAll("#recList [data-rid]").length)===1);
 // start card
 await p.evaluate(()=>showView("lesen"));await p.waitForTimeout(500);const who=p.locator("#lsWho");T("start card: who reads",await who.count()===1&&(await who.inputValue())==="kind");
 await p.locator("#lsWhoRow").scrollIntoViewIfNeeded();await p.locator("#lsWhoRow").locator("..").screenshot({path:"qa/lrec_start.png"});
 await who.selectOption("erw");T("choice is kept",await p.evaluate(()=>S.lsWho)==="erw");
 // per-reader voice pitch
 await p.evaluate(()=>{lsStart({id:"x1",level:"mittel",title:"T",text:"Der Hund läuft schnell nach Hause.",lang:"de",q:[["?",["a","b","c"]]]})});await p.waitForTimeout(200);
 await p.evaluate(()=>{S.lsEngine="ohr";LS.mode="mic";LS.phase="reading";lsRender()});await p.waitForTimeout(200);
 T("indicator while reading",await p.evaluate(()=>/● Aufnahme/.test(document.querySelector(".lsmini").textContent)));
 await p.evaluate(()=>{S.recOn=false;lsRender()});T("no indicator when switched off",await p.evaluate(()=>!/Aufnahme/.test(document.querySelector(".lsmini").textContent)));}
await ctx.close()}
console.log(`\n${pass} passed, ${fail} failed`);await b.close()})();
