// Dictation blocks: logical, not too short, not too long, never a break inside a phrase or after «und»/an article,
// and the player plays every block (recorded voice: block, then its parts with the spoken punctuation).
//   node tools/qa/diktat_blocks.js [url]      (default http://localhost:8770/index.html)
const {chromium}=require("playwright");
(async()=>{const b=await chromium.launch();let pass=0,fail=0;const T=(n,ok,x)=>{ok?pass++:fail++;console.log((ok?"PASS":"FAIL")+" "+n+(x&&!ok?" – "+x:""))};
const p=await b.newPage();p.on("pageerror",e=>console.log("PAGEERR",e.message));await p.route("**/ohr/**",r=>r.abort());
await p.goto(process.argv[2]||"http://localhost:8770/index.html");await p.waitForTimeout(1500);
const EXTRA=[
 {id:"x1",lang:"de",text:"Der Lehrer erklärte uns, dass man das Wort «dass» mit Doppel-s schreibt, wenn man es nicht durch «dieses» oder «welches» ersetzen kann."},
 {id:"x2",lang:"de",text:"Die Schülerinnen und Schüler der sechsten Klasse organisierten einen Kuchenverkauf, um Geld für das Tierheim zu sammeln."},
 {id:"x3",lang:"en",text:"Last summer my family and I spent two weeks at a small campsite near the sea."},
 {id:"x4",lang:"de",text:"Mein Bruder und ich ziehen warme Kleider an und gehen nach draussen. Im Winter schläft das Tier tief und fest."},
 {id:"x5",lang:"fr",text:"Le samedi matin, je vais au marché avec ma mère pour acheter des fruits, des légumes et du fromage."}];
const R=await p.evaluate(EX=>[...DKT,...EX].map(t=>{const T=toks(t.text),ch=makeChunks(T,t.lang);
 const U=ch.map(c=>toUnits(c));return{id:t.id,lang:t.lang,text:t.text,c:ch.map(joinPlain),
  words:U.map(u=>u.map(x=>[x.word,x.tail])),parts:ch.map(c=>chunkParts(c,t.lang).filter(x=>!x.p).map(x=>x.t)),
  sentEnd:U.map(u=>/[.!?]["»”“]*$/.test(u[u.length-1].tail)),join:joinPlain(T)}}),EXTRA);
const CONJ=/^(und|oder|aber|denn|sondern|weil|dass|wenn|als|damit|ob|während|obwohl|nachdem|and|or|but|because|that|et|ou|mais|parce|que)$/i;
const ART={de:/^(der|die|das|den|dem|des|ein|eine|einen|einem|einer|eines|mein|meine|dein|sein|seine|ihr|ihre|unser|unsere)$/i,en:/^(the|a|an|my|your|his|her|our|their)$/i,fr:/^(le|la|les|un|une|des|du|au|aux|mon|ma|mes|ton|ta|son|sa|ses)$/i};
const bad=[],short=[],long=[],lost=[];
R.forEach(t=>{
 if(t.c.join(" ").replace(/\s+/g," ")!==t.join.replace(/\s+/g," "))lost.push(t.id);
 // sentence lengths: a block of 1–2 words is only allowed if its whole sentence is that short
 let sent=[],sents=[];t.words.forEach((w,i)=>{sent.push(i);if(t.sentEnd[i]){sents.push(sent);sent=[]}});if(sent.length)sents.push(sent);
 sents.forEach(S=>{const n=S.reduce((a,i)=>a+t.words[i].length,0);S.forEach(i=>{const w=t.words[i].length;if(w<=2&&n>2)short.push(`${t.id}: ${t.c[i]}`)})});
 t.words.forEach((w,i)=>{if(w.length>12)long.push(`${t.id}: ${t.c[i]}`);const last=w[w.length-1];
  if(!t.sentEnd[i]&&!last[1]&&(CONJ.test(last[0])||ART[t.lang].test(last[0])))bad.push(`${t.id}: …${t.c[i].slice(-30)} |`)});
});
T("blocks rebuild the text exactly (nothing lost or doubled)",!lost.length,lost.join(", "));
T("no block ends with «und», a conjunction or an article",!bad.length,bad.join(" · "));
T("no block of one or two words (unless the sentence is that short)",!short.length,short.join(" · "));
T("no block longer than 12 words",!long.length,long.join(" · "));
const all=R.flatMap(t=>t.c.map(c=>c.split(/\s+/).length)),mean=all.reduce((a,b)=>a+b,0)/all.length;
T(`average block length 5–8 words (${mean.toFixed(1)})`,mean>=5&&mean<=8);
const by=Object.fromEntries(R.map(t=>[t.id,t.c]));
const has=(id,s)=>(by[id]||[]).includes(s);
T("long opening phrase stays together: «In der letzten Woche vor den Herbstferien | hatte …»",has("de-projektwoche","In der letzten Woche vor den Herbstferien"),by["de-projektwoche"].join(" | "));
T("13 words are split at a phrase boundary: «Am Sonntag möchte ich mit Papa | eine lange Fahrt …»",has("de-brief","Am Sonntag möchte ich mit Papa"),by["de-brief"].join(" | "));
T("a quoted word stays in its block",has("x1","dass man das Wort «dass» mit Doppel-s schreibt,")&&has("x1","wenn man es nicht durch «dieses» oder «welches» ersetzen kann."),by.x1.join(" | "));
T("«Schülerinnen und Schüler der sechsten Klasse» is not torn apart",by.x2.some(c=>/Schülerinnen und Schüler der sechsten Klasse/.test(c)),by.x2.join(" | "));
T("«my family and I» stays together",by.x3.some(c=>/my family and I/.test(c)),by.x3.join(" | "));
T("«Mein Bruder und ich» stays together, «tief und fest» too",has("x4","Mein Bruder und ich ziehen warme Kleider an")&&has("x4","Im Winter schläft das Tier tief und fest."),by.x4.join(" | "));
T("French purpose clause: «… avec ma mère | pour acheter …»",has("x5","je vais au marché avec ma mère"),by.x5.join(" | "));
T("parts inside a block are split only at punctuation",R.every(t=>t.parts.every((ps,i)=>ps.join(" ").replace(/[^\p{L}\p{N}]+/gu," ").trim()===t.c[i].replace(/[^\p{L}\p{N}]+/gu," ").trim())));
// player: with a recording, every block is played (block, then its parts joined with the spoken punctuation)
const seq=await p.evaluate(async()=>{const t=DKT.find(x=>x.id==="de-projektwoche");const j=vJob(t);const seg=[0,1];
 VIDX.texts[vKey(t)]={lang:"de",file:"audio/v/x.mp3",s:j.s.map(()=>seg),c:j.c.map(()=>seg),p:j.p.map(r=>r.map(()=>seg)),cut:3};
 VIDX.punct["de-"+vGender("de")]={file:"audio/v/p.mp3",map:{",":seg,".":seg,"?":seg,"!":seg,":":seg,";":seg,open:seg,close:seg}};
 const log=[];recPlay=(f,s)=>{log.push("one");return Promise.resolve("ok")};recPlaySeq=(items)=>{log.push("seq"+items.length);return Promise.resolve("ok")};
 dkWait=()=>Promise.resolve();showView("diktat");dkStart(t);DKS.phase="write";DKS.i=0;await dkRun();return{log,chunks:DKS.chunks.length,phase:DKS.phase}});
T("player plays all blocks with the recording",/^(check|submit)$/.test(seq.phase)&&seq.log.filter(x=>x==="one").length>=seq.chunks&&seq.log.filter(x=>/^seq/.test(x)).length===seq.chunks,JSON.stringify(seq));
console.log(`\n${pass} passed, ${fail} failed`);await b.close();process.exit(fail?1:0)})();
