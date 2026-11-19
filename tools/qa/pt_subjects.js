// «Vokabeln auf Papier» also in Deutsch / Französisch / Englisch: entry on the subject page and on each word list; word list + learning from there.
const {chromium}=require("playwright");
(async()=>{const b=await chromium.launch({args:["--disable-dev-shm-usage"]});let pass=0,fail=0;const T=(n,ok,x)=>{ok?pass++:fail++;console.log((ok?"PASS":"FAIL")+" "+n+(x?" – "+x:""))};
const ctx=await b.newContext({viewport:{width:390,height:844},deviceScaleFactor:2});
await ctx.addInitScript(()=>{if(localStorage.getItem("lernquest.v1"))return;localStorage.setItem("lernquest.v1",JSON.stringify({name:"Dario",grade:6,gradeSet:true,region:"ost",wishes:[],progress:{},cards:{},history:{},coins:10,pin:"1234",
 deck:[...[["le château","das Schloss"],["la forêt","der Wald"],["le garçon","der Junge"],["la sœur","die Schwester"]].map(([f,d],i)=>({id:"f"+i,subj:"fr",type:"vocab",front:f,back:d,unit:"Unité 3",at:1})),
  ...["Gefährlichkeit","Straße","Ärger","wahrscheinlich"].map((w,i)=>({id:"d"+i,subj:"de",type:"spell",front:w,back:"",unit:"Merkwörter 5",at:1}))]}))});
const p=await ctx.newPage();p.on("pageerror",e=>console.log("PAGEERR",e.message));await p.route("**/ohr/**",r=>r.abort());await p.route("**/fonts.googleapis.com/**",r=>r.abort());
await p.goto("http://localhost:8770/index.html");await p.waitForTimeout(1300);await p.evaluate(()=>{const e=document.getElementById("standSheet");if(e)e.remove()});
const opts=()=>p.evaluate(()=>[...document.querySelectorAll("#ptKey option")].map(o=>o.value));
for(const k of ["fr","en"]){
 await p.evaluate(k=>{showView("spielen");openTopics(k)},k);await p.waitForTimeout(300);
 const top=p.locator("#topicList > [data-ptopen]");T(`${k}: «Vokabeln auf Papier» at the top of the subject page`,await top.count()===1,await top.textContent());
 if(k==="fr")await p.screenshot({path:"qa/wpdf/subj_fr.png"});
 await top.click();await p.waitForTimeout(300);const o=await opts();T(`${k}: only ${k} lists`,o.length>0&&o.every(x=>x.startsWith(k+"|")),o.slice(0,4).join(" "));
 T(`${k}: back goes to the subject`,/Zurück zu (Französisch|Englisch)/.test(await p.locator("[data-ptback]").first().textContent()));
 if(k==="fr")await p.locator("#ptView").screenshot({path:"qa/wpdf/subj_fr_setup.png"});
 await p.click("[data-ptback]");await p.waitForTimeout(300);T(`${k}: back → subject page`,await p.evaluate(()=>document.getElementById("v-spielen").classList.contains("on")&&document.getElementById("topics").style.display==="flex"));
 // one word list → «Auf Papier» with that list chosen
 const tile=p.locator("#topicList .lvtile",{has:p.locator("[data-ptlist]")}).nth(1);const nm=(await tile.locator("h3").textContent()).trim();await tile.locator("[data-ptlist]").click();await p.waitForTimeout(300);
 const sel=await p.evaluate(()=>{const s=document.querySelector("#ptKey");return s.options[s.selectedIndex].textContent});T(`${k}: «Auf Papier» on a list chooses that list`,sel.includes(nm.replace(/\s*[🖐️🤖]+$/u,"").trim().slice(0,12)),nm+" → "+sel);
 await p.click("[data-ptback]");await p.waitForTimeout(200)}
// German: lists from the notebook (Merkwörter), Diktat / Abschreiben
await p.evaluate(()=>{showView("spielen");openTopics("de")});await p.waitForTimeout(300);await p.click("#topicList > [data-ptopen]");await p.waitForTimeout(300);
T("de: German notebook lists, modes Diktat/Abschreiben",(await opts()).join()==="de|Merkwörter 5"&&(await p.evaluate(()=>[...document.querySelectorAll("[data-ptdir]")].map(x=>x.textContent).join("|")))==="Diktat|Abschreiben");
await p.click("#ptAllSubj");await p.waitForTimeout(200);T("de: «Listen aus allen Fächern» shows all",(await opts()).some(x=>x.startsWith("fr|")));
// learn from the paper page: word list and a game round with these words
await p.evaluate(()=>{PTPRE={subj:"fr",from:"fr"};ptRender()});await p.waitForTimeout(200);await p.selectOption("#ptKey","fr|Unité 3");
await p.click("#ptVl");await p.waitForTimeout(200);T("word list opens from the paper page",await p.evaluate(()=>document.querySelectorAll("#vocabSheet tbody tr").length)===4);
await p.evaluate(()=>document.getElementById("vocabSheet").remove());
await p.click("#ptLearn");await p.waitForTimeout(400);const r=await p.evaluate(()=>({v:document.getElementById("v-spielen").classList.contains("on"),play:document.getElementById("play").style.display,ids:R&&R.seq.every(x=>/^heft:f/.test(x)),n:R&&R.seq.length}));
T("«Wörter lernen» starts a round with exactly these words",r.v&&r.play==="flex"&&r.ids&&r.n>0,JSON.stringify(r));
// German page without notebook words: explains what to do
await p.evaluate(()=>{S.deck=S.deck.filter(d=>d.subj!=="de");PT={phase:"setup"};PTPRE={subj:"de",from:"de"};showView("ptest")});await p.waitForTimeout(300);
T("de without lists: explains how to get one",/Merkwörtern/.test(await p.locator("#ptView").textContent())&&await p.locator("#ptAllSubj").count()===1);
// Heft card still opens all subjects
await p.evaluate(()=>{showView("heft")});await p.waitForTimeout(200);await p.click("#v-heft [data-ptopen]");await p.waitForTimeout(300);T("Heft: all subjects as before",(await opts()).some(x=>x.startsWith("fr|"))&&/Zurück zum Heft/.test(await p.locator("[data-ptback]").first().textContent()));
T("no horizontal overflow",!(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth)));
console.log(`\n${pass} passed, ${fail} failed`);await b.close()})();
