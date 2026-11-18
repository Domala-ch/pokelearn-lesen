// Wörterliste → Arbeitsblatt-PDF: all modes, accents, long words, via the real list sheet.
const {chromium}=require("playwright");const fs=require("fs"),{execSync}=require("child_process");
(async()=>{const b=await chromium.launch({args:["--disable-dev-shm-usage"]});let pass=0,fail=0;const T=(n,ok,x)=>{ok?pass++:fail++;console.log((ok?"PASS":"FAIL")+" "+n+(x?" – "+x:""))};
const ctx=await b.newContext({viewport:{width:390,height:844},deviceScaleFactor:2});
await ctx.addInitScript(()=>localStorage.setItem("lernquest.v1",JSON.stringify({name:"Dario",grade:6,gradeSet:true,region:"ost",wishes:[],progress:{},cards:{},history:{},coins:10,pin:"1234",
 deck:[...[["le château","das Schloss"],["l'œuf (m.)","das Ei"],["la forêt","der Wald"],["être en train de faire qc","gerade dabei sein, etwas zu tun"],["où ?","wo?"],["le garçon","der Junge"],["Ça coûte combien ?","Wie viel kostet das?"],["la sœur","die Schwester"]].map(([f,d],i)=>({id:"f"+i,subj:"fr",type:"vocab",front:f,back:d,unit:"Unité 3 – En ville",at:1})),
  ...["Gefährlichkeit","Schifffahrtsgesellschaft","Ärger","Straße","Fußballweltmeisterschaftsqualifikationsspiel","wahrscheinlich"].map((w,i)=>({id:"d"+i,subj:"de",type:"spell",front:w,back:"",unit:"Merkwörter 5",at:1}))]})));
const p=await ctx.newPage();p.on("pageerror",e=>console.log("PAGEERR",e.message));await p.route("**/fonts.googleapis.com/**",r=>r.abort());await p.route("**/ohr/**",r=>r.abort());
await p.goto("http://localhost:8770/index.html");await p.waitForTimeout(1300);await p.evaluate(()=>{const e=document.getElementById("standSheet");if(e)e.remove();window.__pdf=[];wordSheetOut=(blob,name,st)=>{blob.arrayBuffer().then(a=>{const u=new Uint8Array(a);let s="";for(let i=0;i<u.length;i+=8192)s+=String.fromCharCode.apply(null,u.subarray(i,i+8192));window.__pdf.push({name,b64:btoa(s)})})}});
const open=async(subj,unit)=>p.evaluate(([subj,unit])=>{const t=heftTopicsOf(subj).find(x=>x.name.includes(unit));vocabSheet(t,t.key);return!!t},[subj,unit]);
const get=async()=>{await p.waitForTimeout(300);const x=await p.evaluate(()=>window.__pdf.pop());if(!x)return null;const f="qa/wpdf/"+x.name;fs.writeFileSync(f,Buffer.from(x.b64,"base64"));return f};
T("FR list opens",await open("fr","Unité 3"));
await p.click('[data-vs="pr"]');await p.waitForTimeout(200);await p.locator(".gsheetin").screenshot({path:"qa/wpdf/ui_fr.png"});
const modes=await p.evaluate(()=>[...document.querySelectorAll("[data-pm]")].map(x=>x.textContent));T("FR modes",modes.join("|")==="Deutsch zeigen|Französisch zeigen|Gemischt|Diktat",modes.join("|"));
for(const m of ["b","a","mix","dict"]){await p.click(`[data-pm="${m}"]`);await p.click('[data-vs="mk"]');const f=await get();
 const ok=f&&execSync(`qpdf --check "${f}" 2>&1 || true`).toString().includes("No syntax or stream encoding errors");const tx=f?execSync(`pdftotext -layout "${f}" -`).toString():"";
 T(`FR ${m}: valid PDF`,ok,f);
 if(m==="b")T("FR b: German shown, French only on the key page",/das Schloss/.test(tx.split("Lösungen")[0])&&!/château/.test(tx.split("Lösungen")[0])&&/le château/.test(tx)&&/l’œuf|l'œuf/.test(tx)&&/Ça coûte combien/.test(tx)&&/sœur/.test(tx),tx.slice(0,300).replace(/\s+/g," "));
 if(m==="a")T("FR a: French shown",/le château/.test(tx.split("Lösungen")[0])&&/forêt/.test(tx));
 if(m==="mix"){const f1=tx.split("Lösungen")[0];const nFr=["château","forêt","garçon","sœur","œuf","train","où","coûte"].filter(w=>f1.includes(w)).length;T("FR mix: half French, half German shown",nFr===4,"French shown: "+nFr)}
 if(m==="dict")T("FR dict: page 1 no words, key with words",!/château|Schloss/.test(tx.split("Lösungen")[0])&&/château/.test(tx),"")
 execSync(`pdftoppm -r 60 -png "${f}" qa/wpdf/fr_${m}`)}
await p.click('[data-vs="close"]');T("DE spelling list opens",await open("de","Merkwörter"));await p.click('[data-vs="pr"]');await p.waitForTimeout(200);
T("DE modes",(await p.evaluate(()=>[...document.querySelectorAll("[data-pm]")].map(x=>x.textContent).join("|")))==="Abschreiben|Diktat");
await p.click('[data-vs="mk"]');let f=await get();let tx=execSync(`pdftotext -layout "${f}" -`).toString();T("DE copy: long words and ß/ä/ü",/Fußballweltmeisterschaftsqualifikationsspiel/.test(tx.replace(/\s/g,""))&&/Straße/.test(tx)&&/Ärger/.test(tx),tx.slice(0,200).replace(/\s+/g," "));execSync(`pdftoppm -r 60 -png "${f}" qa/wpdf/de_copy`);
// a long list: several pages, numbers continue
const n=await p.evaluate(()=>{const t={name:"Lange Liste",ids:[]};const rows=Array.from({length:60},(_,i)=>({a:"le mot numéro "+(i+1),b:"das Wort Nummer "+(i+1),lang:"fr"}));const r=wordSheetPdf(t,rows,{mode:"b",shuffle:false,key:true});window.__pdf=[];wordSheetOut(r.blob,"lang.pdf");return r.pages});
f=await get();tx=execSync(`pdftotext -layout "${f}" -`).toString();T("60 words: several pages, all numbered, footer page x of y",n>=3&&/Nummer 60/.test(tx)&&new RegExp(`Seite ${n} von ${n}`).test(tx),n+" pages");
console.log(`\n${pass} passed, ${fail} failed`);await b.close()})();
