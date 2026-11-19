// ===== PokeLearn-Ohr · Motor: Mikrofon → Erkenner im Gerät → gehörte Wörter =====
// Own microphone pipeline (no browser speech service): the sound stays on the device, nothing restarts while reading,
// and the recognizer answers about 0.2 s after a word – the same on phone, tablet and computer.
let LSOOV=new Set();           // words of the text the recognizer does not know (names, rare compounds): never judged
let LSALIAS=new Map();         // how the recognizer writes a word it only knows in parts or in another form (orientierung+sinn, mia for «Mias»)
const OHRUNK="xxunkxx";        // the recognizer heard a word that is not in the text and not one of the expected misreadings
// Safety net for small devices: if the page died twice while the ear was loading or starting (out of memory), the ear stays off
// on this device and the device's recognizer listens – so reading can never be locked out. Choosing the ear again re-arms it.
const ohrGuard={key:"pl-ohr-guard",get(){try{return JSON.parse(localStorage.getItem(this.key)||"null")}catch(e){return null}},put(g){try{localStorage.setItem(this.key,JSON.stringify(g))}catch(e){}},
 arm(){const g=this.get()||{n:0};g.on=1;g.t=Date.now();this.put(g)},ease(){const g=this.get();if(g&&g.on){g.on=0;this.put(g)}},ok(){try{localStorage.removeItem(this.key)}catch(e){}},
 crashed(){const g=this.get();if(!g)return false;if(g.on){g.n=(g.n||0)+1;g.on=0;g.t=Date.now();this.put(g)}return g.n>=2&&Date.now()-g.t<7*864e5}};
const OHR={st:"idle",err:"",p:null,model:null,lex:null,slow:false,blocked:ohrGuard.crashed(),
 on(lang){return!!OHRBASE&&(lang||"de")==="de"&&S.lsEngine!=="dev"&&!this.slow&&this.st!=="failed"&&typeof WebAssembly==="object"&&typeof Worker==="function"
   &&!!(navigator.mediaDevices&&navigator.mediaDevices.getUserMedia)&&!!(window.AudioContext||window.webkitAudioContext)},
 load(){if(this.p)return this.p;if(this.blocked){this.st="failed";this.err="das Laden ist auf diesem Gerät zweimal abgebrochen";return this.p=Promise.resolve(false)}
  this.st="loading";this.err="";ohrGuard.arm();const base=new URL(OHRBASE,location.href).href;
  const work=(async()=>{
   if(!window.Vosk)await new Promise((res,rej)=>{const s=document.createElement("script");s.src=base+"vosk.js";s.onload=res;s.onerror=()=>rej(new Error("Programm nicht geladen"));document.head.appendChild(s)});
   const lexP=fetch(base+"de-lex.txt").then(r=>{if(!r.ok)throw new Error("Wortliste "+r.status);return r.text()});
   const head=await fetch(base+"de-model.tar.gz",{method:"HEAD"}).catch(()=>null);if(head&&!head.ok)throw new Error("Modell "+head.status);   // (no answer at all: maybe offline – a saved copy still works)
   const model=await Vosk.createModel(base+"de-model.tar.gz",-1);
   this.lex=ohrLexParse(await lexP);this.model=model;return true})();
  const guard=new Promise((_,rej)=>setTimeout(()=>rej(new Error("Zeit abgelaufen")),180000));
  this.p=Promise.race([work,guard]).then(()=>{this.st="ready";ohrGuard.ok();return true}).catch(e=>{this.st="failed";this.err=String(e&&e.message||e);ohrGuard.ok();return false}).then(r=>{try{lsEngineUI()}catch(e){}return r});
  return this.p}};
// strictness: how sure the ear must be before it reports a misreading (prior of the text : weight of a misreading).
// Measured with real voices (2 900 words each): Normal ≈ 0.5 false stops per 100 words; Streng ≈ 1.1 and catches more small words.
const ohrOpts=()=>{const k=S.lsStrictEar??1;return k===2?{R:300,kc:20,ke:3,kn:8}:k===0?{R:600,kc:1,ke:1,kn:1}:{R:300,kc:3,ke:1,kn:2}};
// --- sound: band-limited resampling to 16 kHz; «warp» plays a child's voice slightly lower so it sounds like the adult voices the recognizer learnt from
function ohrResampler(fs){const st={fs,alpha:1,buf:new Float32Array(0),t:0,tab:null,half:0,step:0,PH:32};
 const build=()=>{st.step=st.fs/(16000*st.alpha);const fc=Math.min(1,1/st.step)*.92,half=st.half=Math.ceil(8/fc),PH=st.PH,tab=st.tab=new Float32Array((PH+1)*2*half);
  for(let p=0;p<=PH;p++){const fr=p/PH;let sum=0;for(let k=0;k<2*half;k++){const d=(k-half+1)-fr,x=d*fc,s=x===0?1:Math.sin(Math.PI*x)/(Math.PI*x),w=.5+.5*Math.cos(Math.PI*d/half),c=Math.abs(d)<half?s*w:0;tab[p*2*half+k]=c;sum+=c}
   for(let k=0;k<2*half;k++)tab[p*2*half+k]/=sum||1}};
 build();st.setAlpha=a=>{if(Math.abs(a-st.alpha)>.004){st.alpha=a;build()}};
 st.push=x=>{const b=new Float32Array(st.buf.length+x.length);b.set(st.buf);b.set(x,st.buf.length);const half=st.half,n2=2*half,out=[];let t=st.t;
  if(t<half-1)t=half-1;
  while(t+half<b.length){const i0=Math.floor(t),ph=Math.round((t-i0)*st.PH),o=ph*n2,s0=i0-half+1;let acc=0;for(let k=0;k<n2;k++)acc+=b[s0+k]*st.tab[o+k];out.push(acc);t+=st.step}
  const keep=Math.max(0,Math.floor(t)-half);st.buf=b.slice(keep);st.t=t-keep;return Float32Array.from(out)};
 return st}
// --- pitch of the voice (median of voiced moments): children's voices are higher, the recognizer hears them better slightly lowered
function ohrPitch(O,x){const P=O.pit||(O.pit={dec:Math.max(1,Math.round(O.fs/8000)),acc:0,n:0,ring:new Float32Array(512),w:0,cnt:0,f0:[]});const fs8=O.fs/P.dec;
 for(let i=0;i<x.length;i++){P.acc+=x[i];if(++P.n===P.dec){P.ring[P.w++&511]=P.acc/P.dec;P.acc=0;P.n=0;if(++P.cnt>=512&&P.cnt%256===0){
   const f=new Float32Array(512);let e=0;for(let k=0;k<512;k++){f[k]=P.ring[(P.w+k)&511];e+=f[k]*f[k]}if(e/512<1e-5)continue;
   const lo=Math.floor(fs8/420),hi=Math.ceil(fs8/75);let best=0,bl=0;const r=[];
   for(let lag=lo;lag<=hi;lag++){let a=0,b=0,c=0;for(let k=0;k<512-lag;k++){a+=f[k]*f[k+lag];b+=f[k]*f[k];c+=f[k+lag]*f[k+lag]}const v=a/Math.sqrt(b*c+1e-12);r[lag]=v;if(v>best){best=v;bl=lag}}
   if(best<.62)continue;for(let lag=lo;lag<bl;lag++)if(r[lag]>=.9*best&&r[lag]>=(r[lag-1]||0)&&r[lag]>=(r[lag+1]||0)){bl=lag;break}
   P.f0.push(fs8/bl);P.nv=(P.nv||0)+1;if(P.f0.length>400)P.f0.shift();P.fresh=true}}}
 if(P.fresh&&P.nv>=60&&!(P.nv%30)){P.fresh=false;const s=[...P.f0].sort((a,b)=>a-b),m=s[s.length>>1];O.f0=m;return m}return 0}   // about two seconds of voiced sound before the first estimate
const ohrAlpha=f0=>!f0||f0<=185?1:f0>=300?1.2:1+(f0-185)/115*.2;
// --- start listening (called from the tap on the microphone)
async function ohrStart(L){const AC=window.AudioContext||window.webkitAudioContext;let ctx;try{ctx=new AC({latencyHint:"interactive"})}catch(e){try{ctx=new AC()}catch(e2){return false}}
 try{ctx.resume()}catch(e){}
 ohrGuard.arm();
 const O=L.ohr={ctx,fs:ctx.sampleRate,fin:[],part:[],mute:false,out:[],outN:0,sent:[],lag:0,late:0,dead:false,chunks:0,peak:0,lvl:0,tLvl:0,t0:performance.now()};
 try{O.stream=await navigator.mediaDevices.getUserMedia({audio:{channelCount:1,echoCancellation:true,noiseSuppression:true,autoGainControl:true}})}
 catch(e){ohrStop(L);return false}
 if(LS!==L||L.phase!=="reading"||L.ohr!==O){ohrStop(L,O);return true}
 try{O.stream.getAudioTracks().forEach(t=>{t.onended=()=>{if(LS===L&&L.ohr===O&&L.phase==="reading"){ohrStop(L);L.srLive=false;L.srNeedTap=true;lsMicUI()}}})}catch(e){}
 try{const g=O.g=ohrGrammar(OHR.lex,L.expN);LSOOV=new Set(g.oov.map(i=>L.expN[i]));LSALIAS=g.alias;L._subKey=null;
  ohrNewRec(L,O);
  const src=O.src=ctx.createMediaStreamSource(O.stream);O.rs=ohrResampler(O.fs);O.rs.setAlpha(ohrAlpha(S.ohrF0||0));
  const sink=ctx.createGain();sink.gain.value=0;sink.connect(ctx.destination);
  let ok=false;
  if(ctx.audioWorklet&&window.AudioWorkletNode){try{
    const code='class P extends AudioWorkletProcessor{constructor(){super();this.b=new Float32Array(1024);this.n=0}process(i){const c=i[0]&&i[0][0];if(c){this.b.set(c,this.n);this.n+=c.length;if(this.n>=1024-128){this.port.postMessage(this.b.slice(0,this.n));this.n=0}}return true}}registerProcessor("ohr-tap",P)';
    const url=URL.createObjectURL(new Blob([code],{type:"application/javascript"}));await ctx.audioWorklet.addModule(url);URL.revokeObjectURL(url);
    const node=O.node=new AudioWorkletNode(ctx,"ohr-tap",{numberOfInputs:1,numberOfOutputs:1,channelCount:1});node.port.onmessage=e=>ohrFeed(L,O,e.data);src.connect(node);node.connect(sink);ok=true}catch(e){}}
  if(!ok){const node=O.node=ctx.createScriptProcessor(2048,1,1);node.onaudioprocess=e=>ohrFeed(L,O,new Float32Array(e.inputBuffer.getChannelData(0)));src.connect(node);node.connect(sink)}
 }catch(e){console.error("ohr",e);ohrStop(L);return false}
 if(LS!==L||L.phase!=="reading"||L.ohr!==O){ohrStop(L,O);return true}
 L.eng="ohr";L.srLive=true;L.srNeedTap=false;lsMicUI();lrecBegin(L);if(L.recd)lrecEv(L,{e:"ohr",a:+O.rs.alpha.toFixed(3),who:S.lsWho||"kind"});
 O.wd=setInterval(()=>{if(LS!==L||L.ohr!==O||L.phase!=="reading"){clearInterval(O.wd);return}const t=performance.now()-O.t0;
  if(O.sent.length>30&&t>8000&&ohrRevive(L,O))return;                                                                    // it has stopped answering: start it afresh
  if((t>6000&&!O.chunks)||(O.sent.length>30&&t>8000)){clearInterval(O.wd);ohrGiveWay(L,O);return}                        // no sound reaches the ear, or it cannot be woken
  if(!O.safe&&t>5000&&O.chunks>20){O.safe=true;ohrGuard.ok()}
  if(t>9000&&O.peak<.003&&!O.quiet){O.quiet=true;toast("Ich höre nichts. Ist das Mikrofon erlaubt und nicht stumm?")}
  // the sound stopped coming (another app took the microphone, the phone was locked): one tap continues where the reader was
  if(O.chunks&&!document.hidden&&performance.now()-O.tLast>4000){clearInterval(O.wd);ohrStop(L);L.srLive=false;L.srNeedTap=true;lsMicUI()}},2000);
 return true}
// The ear fell behind or went silent — usually because the device was busy with something else for a moment. It is started afresh and
// keeps listening; the words read so far stay. Only when that happens again and again in one reading is the device too slow for it.
function ohrRevive(L,O){const now=performance.now();if(O.dead||(O.revN||0)>=3)return false;O.revN=(O.revN||0)+1;O.revT=now;O.late=0;
 const keep=O.fin.concat(O.part);try{ohrNewRec(L,O)}catch(e){return false}O.fin=keep;L.srFin=O.fin;L.srFinN=keep.length;return true}
function ohrGiveWay(L,O){if(L.recd)lrecEv(L,{e:"geraet"});O.dead=true;OHR.slow=true;ohrStop(L);if(LS===L&&L.phase==="reading"){L.srLive=false;L.eng="";toast("Das PokeLearn-Ohr kommt auf diesem Gerät nicht nach – jetzt hört die Erkennung des Geräts zu.");lsStartSR();lsMicUI()}}
function ohrNewRec(L,O){if(O.rec){try{O.rec.remove()}catch(e){}}O.fin=[];O.part=[];O.sent=[];O.out=[];O.outN=0;
 const rec=O.rec=new OHR.model.KaldiRecognizer(16000,JSON.stringify(ohrPhrases(OHR.lex,O.g,ohrOpts())));
 const got=()=>{const t=O.sent.shift();if(t){O.lag=performance.now()-t;
   // a device that cannot keep up (answers more than 2 s late, again and again) switches to the device's own recognizer
   if(O.lag>2000){if(++O.late>=6&&!O.dead&&O.rec===rec&&!ohrRevive(L,O))ohrGiveWay(L,O)}else O.late=0}};
 const show=()=>{if(LS!==L||L.ohr!==O||O.rec!==rec)return;const words=[...O.fin,...O.part];L.srFin=O.fin;L.srFinN=O.fin.length;L.srAlt=words.map(()=>OHRNOALT);L.srText=words.join(" ");
  const ta=document.getElementById("lsDict");if(ta){ta.value=L.srText;lsOnDict()}};
 const W=t=>String(t||"").split(/\s+/).filter(Boolean).map(w=>w==="[unk]"?OHRUNK:w);
 rec.on("partialresult",m=>{got();const p=W(m&&m.result&&m.result.partial);if(p.join(" ")!==O.part.join(" ")){if(!O.part.length)O.utt0=performance.now();O.tChg=performance.now();O.part=p;show()}});
 rec.on("result",m=>{got();const w=W(m&&m.result&&m.result.text);O.part=[];O.utt0=0;O.flush=0;if(w.length){O.fin=O.fin.concat(w)}show()});
 rec.on("error",m=>{console.error("ohr rec",m&&m.error)})}
const OHRNOALT=new Set();
function ohrFeed(L,O,x){if(LS!==L||L.ohr!==O||!O.rec||O.dead)return;
 let pk=0;for(let i=0;i<x.length;i+=4){const v=x[i]<0?-x[i]:x[i];if(v>pk)pk=v}O.chunks++;O.tLast=performance.now();if(pk>O.peak)O.peak=pk;O.lvl=Math.max(O.lvl*.7,pk);
 const now=performance.now();if(now-O.tLvl>90){O.tLvl=now;document.documentElement.style.setProperty("--miclvl",Math.min(1,O.lvl*5).toFixed(2))}
 const f0=ohrPitch(O,x);if(f0){const a=ohrAlpha(f0);if(Math.abs(a-O.rs.alpha)>.03&&now-(O.tWarp||-1e9)>5000){O.tWarp=now;O.rs.setAlpha(a)}}   // adjust in clear steps only, not with every sentence melody
 O.spk=Math.max((O.spk||0)*.995,O.lvl);if(O.lvl<.22*O.spk){if(!O.quiet0)O.quiet0=now}else O.quiet0=0;
 if(O.part.length&&O.utt0&&!O.flush&&now-O.utt0>10000&&now-(O.tChg||0)>300&&O.quiet0&&now-O.quiet0>200){O.flush=now;try{O.rec.retrieveFinalResult()}catch(e){}}
 if(O.mute)return;const y=O.rs.push(x);if(L.recd)lrecFeed(L,y);if(!y.length)return;O.out.push(y);O.outN+=y.length;
 // sound goes to the recognizer in 50 ms steps (words appear about 60 ms sooner); a device that falls behind gets 100 ms steps (less work)
 if(O.outN>=(O.lag<250&&O.sent.length<3?800:1600)){const c=new Float32Array(O.outN);let o=0;for(const p of O.out){c.set(p,o);o+=p.length}O.out=[];O.outN=0;
  if(O.sent.length>40)return;                                   // far behind: drop sound instead of queueing more
  O.sent.push(performance.now());try{O.rec.acceptWaveformFloat(c,16000)}catch(e){}}}
function ohrStop(L,O){O=O||(L&&L.ohr);if(!O)return;if(L&&L.ohr===O)L.ohr=null;if(!O.safe)ohrGuard.ease();
 try{if(O.f0&&O.pit&&O.pit.nv>=120&&Math.abs((S.ohrF0||0)-O.f0)>6){S.ohrF0=Math.round(O.f0);save()}}catch(e){}   // remember the reader's voice pitch for the next time
 if(L&&L.recd)lrecEv(L,{e:"aus",f0:O.f0?Math.round(O.f0):0});
 try{O.node&&(O.node.port?(O.node.port.onmessage=null):(O.node.onaudioprocess=null))}catch(e){}
 try{O.src&&O.src.disconnect()}catch(e){}try{O.node&&O.node.disconnect()}catch(e){}
 try{O.stream&&O.stream.getTracks().forEach(t=>t.stop())}catch(e){}try{O.rec&&O.rec.remove()}catch(e){}O.rec=null;clearInterval(O.wd);try{O.ctx&&O.ctx.close()}catch(e){}document.documentElement.style.removeProperty("--miclvl")}
// status line on the reading start card
function lsEngineUI(){const el=document.getElementById("lsEngSt");if(!el)return;if(!OHRBASE){el.textContent="";return}
 if(S.lsEngine==="dev"){el.textContent="Die Spracherkennung von Apple bzw. Google schreibt mit, was sie hört; der Ton geht dafür an deren Dienst.";return}
 const st=OHR.slow?"Auf diesem Gerät zu langsam – es hört die Erkennung des Geräts zu.":OHR.st==="ready"?"✓ bereit":OHR.st==="loading"?"wird geladen … (einmalig etwa 40 MB, danach sofort bereit; bis dahin hört die Erkennung des Geräts zu)":OHR.st==="failed"?"nicht verfügbar ("+OHR.err+") – es hört die Erkennung des Geräts zu.":"";
 el.textContent="Kennt den Text und hört nur auf seine Wörter; der Ton bleibt auf dem Gerät. "+st}
document.addEventListener("visibilitychange",()=>{const O=LS&&LS.ohr;if(O&&!document.hidden&&O.ctx&&O.ctx.state!=="running")try{O.ctx.resume()}catch(e){}
 if(document.hidden)ohrGuard.ease();else if(OHR.st==="loading"||(O&&!O.safe))ohrGuard.arm()});
addEventListener("pagehide",()=>ohrGuard.ease());
