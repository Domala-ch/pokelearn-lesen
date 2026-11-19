// End-to-end timing on the audio clock: when does each word turn green (and a wrong word red), measured from the start of the recording.
// node e2e_green.js <wav> <text> <seconds> <base-url>
const {chromium}=require('/tmp/claude-0/-home-claude/f07ee677-a41f-56b8-9810-2a87a0982a1a/scratchpad/node_modules/playwright');
const WAV=process.argv[2],TEXT=process.argv[3],DUR=+process.argv[4]||60,BASE=process.argv[5]||"http://localhost:8770/";
(async()=>{const b=await chromium.launch({args:["--disable-dev-shm-usage","--use-fake-ui-for-media-stream","--use-fake-device-for-media-stream","--use-file-for-fake-audio-capture="+WAV+"%noloop","--autoplay-policy=no-user-gesture-required"]});
const ctx=await b.newContext({viewport:{width:390,height:844},permissions:["microphone"]});
await ctx.addInitScript(()=>localStorage.setItem("lernquest.v1",JSON.stringify({name:"Leo",grade:6,gradeSet:true,region:"ost",deck:[],wishes:[],progress:{},cards:{},history:{},coins:10,pin:"1234"})));
const p=await ctx.newPage();p.on("pageerror",e=>console.log("PAGEERR",e.message));await p.route("**/fonts.googleapis.com/**",r=>r.abort());
await p.goto(BASE+"index.html");await p.waitForTimeout(1500);await p.evaluate(()=>{const e=document.getElementById("standSheet");if(e)e.remove();speakDev=()=>Promise.resolve("ok");recPlay=()=>Promise.resolve("ok")});
await p.evaluate(()=>OHR.load());
await p.evaluate(t=>{showView("lesen");lsStart({id:"g"+Math.random(),level:"mittel",title:"Test",text:t,lang:"de",q:[["?",["a","b","c"]]]});
 const of=ohrFeed;ohrFeed=function(L,O,x){if(O.tS==null)O.tS=O.ctx.currentTime-x.length/O.fs;return of.apply(this,arguments)};
 window.__g=[];window.__r={};window.__lag=[];setInterval(()=>{const L=LS;if(!L||!L.ohr||L.ohr.tS==null)return;const t=L.ohr.ctx.currentTime-L.ohr.tS;
  for(let k=0;k<L.expN.length;k++){if(window.__g[k]==null&&(L.wst[k]==="ok"||L.wst[k]==="fixed")&&!(L.retry&&L.retry.idx===k))window.__g[k]=+t.toFixed(3)}
  if(L.retry&&window.__r[L.retry.idx]==null)window.__r[L.retry.idx]=+t.toFixed(3);window.__lag.push(L.ohr.lag)},10)},TEXT);
await p.waitForTimeout(200);await p.click("button[data-la=mic]");
for(let i=0;i<DUR*5;i++){await p.waitForTimeout(200);const ph=await p.evaluate(()=>LS&&LS.phase);if(ph!=="reading")break}
const r=await p.evaluate(()=>({g:window.__g,r:window.__r,expN:LS.expN,lagMax:Math.max(0,...window.__lag),lagMed:window.__lag.slice().sort((a,b)=>a-b)[window.__lag.length>>1]}));
console.log(JSON.stringify(r));await b.close()})();
