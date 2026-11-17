// Words without a recording are made ahead of the reader, one at a time, and wait while the ear is busy.
const {chromium}=require("playwright");
(async()=>{const b=await chromium.launch({args:["--disable-dev-shm-usage"]});const ctx=await b.newContext();
await ctx.addInitScript(()=>localStorage.setItem("lernquest.v1",JSON.stringify({name:"Leo",grade:6,gradeSet:true,region:"ost",deck:[],wishes:[],progress:{},cards:{},history:{},coins:10,pin:"1234",lsEngine:"dev"})));
const p=await ctx.newPage();p.on("pageerror",e=>console.log("PAGEERR",e.message));await p.route("**/ohr/**",r=>r.abort());
await p.goto("http://localhost:8770/index.html");await p.waitForTimeout(1500);let pass=0,fail=0;const T=(n,ok,x)=>{ok?pass++:fail++;console.log((ok?"PASS":"FAIL")+" "+n+(x?" – "+x:""))};
await p.evaluate(()=>{const e=document.getElementById("standSheet");if(e)e.remove();window.__w=[];LIVE.ok=()=>true;LIVE.engine=()=>"wasm";LIVE.preload=()=>{};LIVE.warm=(it,l,s,pr)=>window.__w.push(it[0]+":"+pr);
 const rec0=vWordRecAny;vWordRecAny=(w,l)=>/^(der|die|und|im|ein)$/i.test(w)?{file:"x",seg:0}:null;VIDX.words=VIDX.words||{};
 showView("lesen");lsStart({id:"w"+Math.random(),level:"mittel",title:"T",text:"Der Orientierungslauf im Wald und die Kompassnadel zeigen ein Abenteuer.",lang:"de",q:[["?",["a","b","c"]]]})});
await p.waitForTimeout(2700);let r=await p.evaluate(()=>window.__w.join(" "));T("made ahead from the moment the text is shown, in text order, recorded words left out",/^Orientierungslauf:2 Wald:2 Kompassnadel:2/.test(r),r);
r=await p.evaluate(()=>{window.__w=[];LS.ohr={lag:3000,sent:[],mute:false};return 1});await p.waitForTimeout(1600);r=await p.evaluate(()=>window.__w.length);T("waits while the ear is behind",r===0,String(r));
r=await p.evaluate(()=>{LS.ohr.lag=50;LS.prep=null;lsPrepWord(9);return window.__w.join(" ")});T("a word read wrong is made at once, first in line",/Abenteuer:3/.test(r),r);
await p.waitForTimeout(1700);r=await p.evaluate(()=>{const x=window.__w.join(" ");LS.ohr=null;return x});T("then on with the rest, nothing twice",/zeigen/.test(r)&&(r.match(/Abenteuer/g)||[]).length===1,r);
console.log(`\n${pass} passed, ${fail} failed`);await b.close()})();
