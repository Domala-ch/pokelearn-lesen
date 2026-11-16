// Builds the grammars for the bench with the production code (inside the app page, so the judge's rules apply).
const {chromium}=require('/tmp/claude-0/-home-claude/f07ee677-a41f-56b8-9810-2a87a0982a1a/scratchpad/node_modules/playwright');const fs=require('fs');
const APP=process.argv[2]||"/home/claude/lernquest.html";
(async()=>{const b=await chromium.launch({args:["--disable-dev-shm-usage"]});const p=await b.newPage();p.on("pageerror",e=>console.log("ERR",e.message));
fs.writeFileSync("/tmp/gen_page.html",'<meta charset="utf-8">'+fs.readFileSync(APP,"utf8"));await p.goto("file:///tmp/gen_page.html");await p.waitForTimeout(800);
await p.addScriptTag({content:fs.readFileSync("src/ohr_gram.js","utf8")+";window.ohrGrammar=ohrGrammar;window.ohrLexParse=ohrLexParse;"});
await p.evaluate(t=>{window.LEX=ohrLexParse(t)},fs.readFileSync("web/ohr/de-lex.txt","utf8"));
const MIS=JSON.parse(fs.readFileSync(process.env.MISFILE||"miscues.json"));
const t0=Date.now();const out=await p.evaluate(MIS=>MIS.map(m=>{lsStart({id:"x"+Math.random(),level:"mittel",title:"T",text:m.text||m.E.join(" ")+".",lang:"de",q:[["?",["a","b","c"]]]});LSLANG="de";LSSTRICT=true;
  const g=ohrGrammar(LEX,LS.expN);return{phrase:g.phrase,vars:g.vars,oov:g.oov.map(i=>LS.expN[i]),n:LS.expN.length}}),MIS);
console.log("grammars",out.length,"in",Date.now()-t0,"ms; avg variants",(out.reduce((a,g)=>a+g.vars.length,0)/out.length).toFixed(1),"per text of avg",(out.reduce((a,g)=>a+g.n,0)/out.length).toFixed(1),"words; oov words",out.reduce((a,g)=>a+g.oov.length,0));
const c={};out.forEach(g=>g.vars.forEach(v=>c[v[1]]=(c[v[1]]||0)+1));console.log(c);console.log(JSON.stringify(out[0]).slice(0,900));
fs.writeFileSync(process.env.GRAMMARS||"grammars.json",JSON.stringify(out));await b.close()})();
