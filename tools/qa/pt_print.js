// Vokabeln auf Papier: print a worksheet (all modes), photo check with per-word direction, built-in lists, Wörterliste without print.
const {chromium}=require("playwright");const fs=require("fs"),{execSync}=require("child_process");
(async()=>{const b=await chromium.launch({args:["--disable-dev-shm-usage"]});let pass=0,fail=0;const T=(n,ok,x)=>{ok?pass++:fail++;console.log((ok?"PASS":"FAIL")+" "+n+(x?" – "+x:""))};
const ctx=await b.newContext({viewport:{width:390,height:844},deviceScaleFactor:2});
await ctx.addInitScript(()=>{if(localStorage.getItem("lernquest.v1"))return;localStorage.setItem("lernquest.v1",JSON.stringify({name:"Dario",grade:6,gradeSet:true,region:"ost",wishes:[],progress:{},cards:{},history:{},coins:10,pin:"1234",
 deck:[...[["le château","das Schloss"],["l'œuf (m.)","das Ei"],["la forêt","der Wald"],["le garçon","der Junge"],["la sœur","die Schwester"],["où ?","wo?"]].map(([f,d],i)=>({id:"f"+i,subj:"fr",type:"vocab",front:f,back:d,unit:"Unité 3 – En ville",at:1})),
  ...["Gefährlichkeit","Straße","Ärger","wahrscheinlich"].map((w,i)=>({id:"d"+i,subj:"de",type:"spell",front:w,back:"",unit:"Merkwörter 5",at:1}))]}))});
const p=await ctx.newPage();p.on("pageerror",e=>console.log("PAGEERR",e.message));await p.route("**/ohr/**",r=>r.abort());await p.route("**/fonts.googleapis.com/**",r=>r.abort());
await p.goto("http://localhost:8770/index.html");await p.waitForTimeout(1300);
await p.evaluate(()=>{const e=document.getElementById("standSheet");if(e)e.remove();window.__pdf=[];window.__said=[];speak=(t,l)=>{window.__said.push(l+":"+t);return Promise.resolve()};
 wordSheetOut=(blob,name)=>{blob.arrayBuffer().then(a=>{const u=new Uint8Array(a);let s="";for(let i=0;i<u.length;i+=8192)s+=String.fromCharCode.apply(null,u.subarray(i,i+8192));window.__pdf.push({name,b64:btoa(s)})})}});
const pdf=async()=>{await p.waitForTimeout(300);const x=await p.evaluate(()=>window.__pdf.pop());if(!x)return"";const f="qa/wpdf/"+x.name;fs.writeFileSync(f,Buffer.from(x.b64,"base64"));return f};
// Wörterliste: no print button any more
T("Wörterliste has no print button",await p.evaluate(()=>{const t=heftTopicsOf("fr")[0];vocabSheet(t,t.key);const r=!document.querySelector('#vocabSheet [data-vs="pr"]');document.getElementById("vocabSheet").remove();return r}));
await p.evaluate(()=>{showView("heft")});await p.waitForTimeout(300);await p.click("[data-ptopen]");await p.waitForTimeout(300);
const opts=await p.evaluate(()=>[...document.querySelectorAll("#ptKey optgroup")].map(g=>g.label+":"+g.children.length));T("lists: from the notebook and PokeLearn's own",opts.length===2&&/Aus dem Heft:2/.test(opts[0]),opts.join(" "));
await p.locator("#ptView .card").first().screenshot({path:"qa/wpdf/pt_setup.png"});
await p.selectOption("#ptKey","fr|Unité 3 – En ville");await p.waitForTimeout(100);
T("FR modes",(await p.evaluate(()=>[...document.querySelectorAll("[data-ptdir]")].map(x=>x.textContent).join("|")))==="Deutsch → Französisch|Französisch → Deutsch|Gemischt|Diktat");
await p.click('[data-ptdir="mix"]');await p.selectOption("#ptN","6");await p.click("#ptPrint");const f1=await pdf();
const st=await p.evaluate(()=>({ph:PT.phase,pr:PT.printed,list:PT.list.map(x=>[x.prompt,x.lang,x.mode])}));T("print → worksheet PDF and the test waits for the photo",st.ph==="photo"&&st.pr&&f1,f1);
const tx=execSync(`pdftotext -layout "${f1}" -`).toString();const sheet=tx.split("Lösungen")[0];
T("PDF rows = test words in the same order (numbers match for checking)",st.list.every((x,i)=>new RegExp(`\\b${i+1}\\s+${x[0].replace(/[.*+?^${}()|[\]\\]/g,"\\$&").replace(/'/g,"['’]")}`).test(sheet)),st.list.map(x=>x[0]).join(", "));
T("mixed: 3 German, 3 French shown",st.list.filter(x=>x[1]==="de").length===3,st.list.map(x=>x[2]).join(","));
T("footer tells where to photograph",/Heft › Vokabeln auf Papier|Vokabeln auf Papier/.test(tx));
await p.locator("#ptView .card").first().screenshot({path:"qa/wpdf/pt_photo.png"});
// photo check: Claude's reading is simulated
const r=await p.evaluate(async()=>{let P="";sample.json=async(prompt)=>{P=prompt;return{items:PT.list.map((x,i)=>({n:i+1,written:i===0?"":i===1?x.target+"e":x.target.replace(/ \(m\.\)/,""),unsure:false}))}};
 ptFiles=[new File(["x"],"a.jpg",{type:"image/jpeg"})];ptRender();await ptCheck();return{P,res:PT.res.map(x=>[x.target,x.written,x.ok,x.why,x.pid]),ph:PT.phase,prog:Object.keys(S.progress).filter(k=>k.startsWith("heft:f")).length}});
T("Claude is told to read only the handwriting on the printed lines",/NUR die Handschrift/.test(r.P)&&/gezeigt: «.+» \((Deutsch|Französisch)\) – geschrieben auf (Französisch|Deutsch)/.test(r.P));
T("result: empty line and wrong spelling are mistakes, the rest right",r.ph==="result"&&r.res[0][2]===false&&/Nicht geschrieben/.test(r.res[0][3])&&r.res[1][2]===false&&/Rechtschreibung/.test(r.res[1][3])&&r.res.slice(2).every(x=>x[2]),JSON.stringify(r.res.slice(0,3)));
T("learning progress counted per word",r.prog===6,String(r.prog));
await p.locator("#ptView").screenshot({path:"qa/wpdf/pt_result.png"});
await p.click("[data-ptredo]");await p.waitForTimeout(300);const f2=await pdf();T("mistakes again on paper: new worksheet with only those",(await p.evaluate(()=>PT.list.length))>=1&&f2&&(await p.evaluate(()=>PT.printed)));
// German list: dictation on screen, PokeLearn reads aloud
await p.evaluate(()=>{S.ptCur=null;ptOpen();PT={phase:"setup"};ptRender()});await p.waitForTimeout(300);
await p.selectOption("#ptKey","de|Merkwörter 5");await p.waitForTimeout(100);T("German modes",(await p.evaluate(()=>[...document.querySelectorAll("[data-ptdir]")].map(x=>x.textContent).join("|")))==="Diktat|Abschreiben");
await p.click('[data-ptdir="dict"]');await p.click("#ptGo");await p.waitForTimeout(600);T("dictation on screen: the word is read aloud, not shown",await p.evaluate(()=>window.__said.length>=1&&window.__said[0].startsWith("de:")&&!document.querySelector(".ptword")));
await p.evaluate(()=>{PT={phase:"setup"};ptRender()});await p.selectOption("#ptKey","de|Merkwörter 5");await p.click('[data-ptdir="dict"]');await p.click("#ptPrint");const f3=await pdf();const t3=execSync(`pdftotext -layout "${f3}" -`).toString();
T("dictation sheet: lines only, words on the key page, read-aloud buttons",!/Straße/.test(t3.split("Lösungen")[0])&&/Straße/.test(t3)&&await p.evaluate(()=>document.querySelectorAll("[data-ptsay]").length===4));
// built-in list
await p.evaluate(()=>{PT={phase:"setup"};ptRender()});const bi=await p.evaluate(()=>{const o=[...document.querySelectorAll('#ptKey optgroup[label="PokeLearn-Wörterlisten"] option')][0];return o&&o.value});
await p.selectOption("#ptKey",bi);await p.click('[data-ptdir="de2f"]');await p.click("#ptPrint");const f4=await pdf();T("PokeLearn list prints too",!!f4&&await p.evaluate(()=>PT.list[0].pid.startsWith("fr:")||PT.list[0].pid.startsWith("en:")),bi);
T("no horizontal overflow",!(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth)));
console.log(`\n${pass} passed, ${fail} failed`);await b.close()})();
