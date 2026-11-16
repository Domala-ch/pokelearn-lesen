// End-to-end: the real app in a browser, a recording played as the microphone, the PokeLearn-Ohr listening.
const {chromium}=require('/tmp/claude-0/-home-claude/f07ee677-a41f-56b8-9810-2a87a0982a1a/scratchpad/node_modules/playwright');const fs=require('fs');
const WAV=process.argv[2],TEXT=process.argv[3],DUR=+process.argv[4]||80,EXPECT=process.argv[5]||"";
(async()=>{const b=await chromium.launch({args:["--disable-dev-shm-usage","--use-fake-ui-for-media-stream","--use-fake-device-for-media-stream","--use-file-for-fake-audio-capture="+WAV+"%noloop","--autoplay-policy=no-user-gesture-required"]});
const ctx=await b.newContext({viewport:{width:390,height:844},permissions:["microphone"]});
await ctx.addInitScript(()=>localStorage.setItem("lernquest.v1",JSON.stringify({name:"Leo",grade:6,gradeSet:true,region:"ost",deck:[],wishes:[],progress:{},cards:{},history:{},coins:10,pin:"1234"})));
const p=await ctx.newPage();p.on("pageerror",e=>console.log("PAGEERR",e.message));p.on("console",m=>{const t=m.text();if(/ohr|error|Error/i.test(t)&&!/LOG \(VoskAPI/.test(t))console.log("C:",t.slice(0,200))});
await p.route("**/fonts.googleapis.com/**",r=>r.abort());
await p.goto("http://localhost:8770/index.html");await p.waitForTimeout(1500);await p.evaluate(()=>{const e=document.getElementById("standSheet");if(e)e.remove();window.__spoken=[];speakDev=(w)=>{window.__spoken.push(w);return Promise.resolve("ok")};recPlay=(f)=>{window.__spoken.push("REC");return Promise.resolve("ok")}});
const t0=Date.now();const ok=await p.evaluate(()=>OHR.load());console.log("engine load:",ok,await p.evaluate(()=>OHR.st+" "+OHR.err),Date.now()-t0,"ms");
await p.evaluate(t=>{showView("lesen");lsStart({id:"e2e"+Math.random(),level:"mittel",title:"Test",text:t,lang:"de",q:[["?",["a","b","c"]]]})},TEXT);await p.waitForTimeout(200);
await p.click("button[data-la=mic]");
const log=[];let last="";const tStart=Date.now();
for(let i=0;i<DUR*5;i++){await p.waitForTimeout(200);
 const s=await p.evaluate(()=>LS?{ph:LS.phase,eng:LS.eng,live:LS.srLive,pos:LS.pos,N:LS.expN.length,retry:LS.retry?LS.retry.idx+":"+LS.expN[LS.retry.idx]+" t"+LS.retry.tries:"",fixed:LS.fixed||0,given:LS.given||0,heard:(document.getElementById("lsDict")||{}).value||"",lag:LS.ohr?Math.round(LS.ohr.lag):-1,hFin:LS.hFin,nH:((document.getElementById("lsDict")||{}).value||"").split(" ").length,f0:LS.ohr&&LS.ohr.f0?Math.round(LS.ohr.f0):0,alpha:LS.ohr&&LS.ohr.rs?LS.ohr.rs.alpha.toFixed(2):"",bad:LS.expN.filter((w,k)=>LS.wst[k]==="bad"||LS.wst[k]==="miss").join(",")}:null);
 if(!s)break;const key=s.pos+"|"+s.retry+"|"+s.ph;if(key!==last){last=key;log.push(((Date.now()-tStart)/1000).toFixed(1)+"s pos "+s.pos+"/"+s.N+(s.retry?" STOP "+s.retry:"")+" ["+s.heard.split(" ").slice(-4).join(" ")+"]")}
 if(s.ph!=="reading"){console.log("finished phase:",s.ph);break}
 if(i%25===24)console.log("  …",JSON.stringify({pos:s.pos,N:s.N,hFin:s.hFin,nH:s.nH,retry:s.retry,fixed:s.fixed,given:s.given,lag:s.lag,f0:s.f0,alpha:s.alpha}))}
const fin=await p.evaluate(()=>({ph:LS.phase,pos:LS.pos,N:LS.expN.length,fixed:LS.fixed||0,given:LS.given||0,spoken:window.__spoken,wst:LS.expN.map((w,k)=>(LS.wst[k]==="ok"?"":LS.wst[k]==="fixed"?"~":LS.wst[k]==="bad"?"✗":LS.wst[k]==="soft"?"·":LS.wst[k]==="miss"?"_":"?")+w).join(" "),oov:[...LSOOV]}));
console.log(log.slice(0,60).join("\n"));console.log(JSON.stringify(fin));
if(EXPECT)console.log(fin.wst.includes(EXPECT)?"PASS expected "+EXPECT:"FAIL expected "+EXPECT);
await b.close()})();
