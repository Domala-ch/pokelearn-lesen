// ===== PokeLearn-Ohr · Grammatik: der Erkenner kennt den Text =====
// The recognizer (Kaldi/Vosk, on the device) only listens for the words of this text – plus the misreadings a reader really makes.
// For every word the text itself is by far the most likely thing to hear (prior R : 1); a misreading is only reported when the
// sound clearly says so. That keeps false alarms low and still catches ein/einen, den/dem, war/waren, Tasche/Tische.
const OHRFAM=(()=>{const F=[["der","die","das","den","dem","des"],["ein","eine","einen","einem","einer","eines"],["im","in"],["am","an"],["zum","zur","zu"],["vom","von"],["beim","bei"],
  ["ihm","ihn","ihnen"],["mir","mich"],["dir","dich"],["war","waren","wäre"],["hat","hatte","hatten","haben","habe"],["ist","sind"],["wird","werden","wurde","wurden"],
  ["kann","konnte","können"],["will","wollte","wollen"],["muss","musste","müssen"],["soll","sollte","sollen"],["er","es"],["sie","sich"],["wir","wie"],["man","mann"],["nicht","nichts"],["sein","sind"]];
 for(const s of["kein","mein","dein","sein","ihr","unser","euer"])F.push(["","e","en","em","er","es"].map(e=>s+e));
 for(const s of["dies","jen","welch","jed","manch","solch"])F.push(["e","en","em","er","es"].map(e=>s+e));
 const m=new Map();for(const f of F)for(const w of f){let s=m.get(w);if(!s)m.set(w,s=new Set());for(const x of f)if(x!==w)s.add(x)}return m})();
let OHRNEAR=15000,OHRNEAR3=700;
const OHRNOISE=/^(ach|aha|ahh|ähm|hey|hmm|oha|ohh|uhh|nee|naja|tja|oje|puh|huch|wow|okay|hallo|haha|hihi|hoppla|ups|pst|psst)$/;   // sounds a reader makes without reading: never taken for a word
const OHRENDS=["","e","en","em","er","es","s","n","t","te","ten","st","et"],OHRALPHA="abcdefghijklmnopqrstuvwxyzäöü";
function ohrLexParse(txt){const nl=txt.indexOf("\n"),nc=parseInt(txt.slice(0,nl),10),words=txt.slice(nl+1).split("\n");if(!words[words.length-1])words.pop();
 const voc=new Set(words),rank=new Map();for(let i=0;i<nc;i++)rank.set(words[i],i);return{voc,rank,nc,top:words.slice(0,6000).filter(w=>w.length>=3&&!OHRNOISE.test(w))}}
// spelling of a (normalised) word in the recognizer's vocabulary: as it is, or with ß for ss
function ohrForm(LEX,n){if(LEX.voc.has(n))return n;if(n.includes("ss")){const all=n.replace(/ss/g,"ß");if(LEX.voc.has(all))return all;
  for(let i=n.indexOf("ss");i>=0;i=n.indexOf("ss",i+1)){const c=n.slice(0,i)+"ß"+n.slice(i+2);if(LEX.voc.has(c))return c}}return null}
// a compound the recognizer does not know is given as its parts (Trinkflasche → trink flasche); the judge joins them again
function ohrSplit(LEX,n,depth){if(n.length<6)return null;let best=null,bs=-1;
 for(let i=3;i<=n.length-3;i++){let a=ohrForm(LEX,n.slice(0,i));if(!a&&/[sn]$/.test(n.slice(0,i))&&i>4)a=ohrForm(LEX,n.slice(0,i-1));if(!a)continue;
  let b=ohrForm(LEX,n.slice(i)),bb=b?[b]:null;if(!bb&&depth>0)bb=ohrSplit(LEX,n.slice(i),depth-1);if(!bb)continue;
  const sc=Math.min(i,n.length-i)-(bb.length-1)*2+(LEX.rank.has(a)?2:0)+(LEX.rank.has(bb[0])?2:0);if(sc>bs){bs=sc;best=[a,...bb]}}
 return best}
// expN: normalised words of the text (the judge's form). Returns the pieces of the grammar; the caller sets how strict it is.
function ohrGrammar(LEX,expN){const N=expN.length,forms=[],alts=[],oov=[],alias=new Map();
 for(let i=0;i<N;i++){const e=expN[i];let f=null,al=[];
  if(/^\d+$/.test(e)){const c=numWords(e).map(w=>ohrForm(LEX,w)||(ohrSplit(LEX,w,1)||[]).join(" ")).filter(Boolean);f=c.length?c[0].split(" "):null;al=c.slice(1)}
  else{const v=ohrForm(LEX,e);f=v?[v]:ohrSplit(LEX,e,1);if(!f&&e.length>3&&e.endsWith("s")){const b=ohrForm(LEX,e.slice(0,-1));if(b)f=[b]}}   // «Mias» → mia
  forms.push(f);alts.push(al);if(!f)oov.push(i);
  else{const j=lsNorm(f.join(""));if(j!==e&&!/^\d+$/.test(e)){let a=alias.get(e);if(!a)alias.set(e,a=new Set());a.add(j)}}}   // what the recognizer writes for this word when it is not the word itself
 const prevTok=i=>{for(let j=i-1;j>=0;j--)if(forms[j])return forms[j][forms[j].length-1];return""},nextTok=i=>{for(let j=i+1;j<N;j++)if(forms[j])return forms[j][0];return""};
 const vars=[],seen=new Set(),add=(i,v,cls)=>{const p=(prevTok(i)+" "+v+" "+nextTok(i)).trim();if(!seen.has(p)){seen.add(p);vars.push([p,cls])}};
 for(let i=0;i<N;i++){const f=forms[i],e=expN[i];if(!f)continue;for(const a of alts[i])add(i,a,"x");if(f.length!==1||/^\d+$/.test(e))continue;
  const eF=foldC(e),eK=koelnC(e),ok=n=>n!==e&&(wordScoreFast([n],e,eF,eK)??0)<2.6,cand=new Map();    // only what the judge would count as a misreading
  const fam=OHRFAM.get(f[0])||OHRFAM.get(e);if(fam)for(const w of fam){const v=ohrForm(LEX,w);if(v&&ok(lsNorm(v)))cand.set(v,"c")}
  if(e.length>=3){
   if(e.length>=5){const inf=[];for(const en of OHRENDS){if(en&&!e.endsWith(en))continue;const st=en?e.slice(0,-en.length):e;if(st.length<4)continue;
     for(const e2 of OHRENDS){const n=st+e2;if(n===e)continue;const v=ohrForm(LEX,n);if(v&&LEX.rank.has(v)&&!cand.has(v)&&!inf.includes(v)&&ok(lsNorm(v)))inf.push(v)}}
    inf.sort((a,b)=>LEX.rank.get(a)-LEX.rank.get(b));for(const v of inf.slice(0,5))cand.set(v,"e")}
   const E1=new Set();for(let k=0;k<=e.length;k++){for(const a of OHRALPHA)E1.add(e.slice(0,k)+a+e.slice(k));if(k<e.length){if(e.length>3)E1.add(e.slice(0,k)+e.slice(k+1));for(const a of OHRALPHA)E1.add(e.slice(0,k)+a+e.slice(k+1))}}
   const near=[];for(const n of E1){if(n===e)continue;const v=ohrForm(LEX,n);if(!v||cand.has(v))continue;const r=LEX.rank.get(v);
    // only everyday words count as possible misreadings (short ones must be very common: no «dei», «ups», «dns»)
    if(r!==undefined&&r<(v.length<=3?OHRNEAR3:OHRNEAR)&&ok(lsNorm(v)))near.push(v)}
   near.sort((a,b)=>LEX.rank.get(a)-LEX.rank.get(b));for(const v of near.slice(0,5))cand.set(v,"n")}
  for(const[v,cls]of cand)add(i,v,cls)}
 return{forms,phrase:forms.filter(Boolean).map(f=>f.join(" ")).join(" "),vars,oov,alias}}
// the grammar the recognizer gets: the text R times, each kind of misreading with its own weight (prior of the text = R : weight).
// A loop of everyday words catches the reader saying something completely different («Garten» for «Wald»).
function ohrPhrases(LEX,g,o){const R=o.R||300,k={x:R,c:o.kc||1,e:o.ke||1,n:o.kn||1},out=[],have=new Set(g.phrase.split(" "));for(let i=0;i<R;i++)out.push(g.phrase);
 for(const[p,cls]of g.vars){for(const w of p.split(" "))have.add(w);for(let i=0;i<k[cls];i++)out.push(p)}
 let n=0;for(const w of LEX.top){if(n>=(o.G??1500))break;if(have.has(w))continue;n++;for(let i=0;i<(o.kg||3);i++)out.push(w)}
 out.push("[unk]");return out}
