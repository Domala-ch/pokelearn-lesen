# Puts the PokeLearn-Ohr code (src/ohr_gram.js + src/ohr_engine.js) into the app and wires it up. Idempotent.
import re,sys
p="/home/claude/lernquest.html";s=open(p,encoding="utf8").read()
def rep(a,b,count=1):
    global s
    assert s.count(a)==count,(s.count(a),a[:90])
    s=s.replace(a,b)
block="// <ohr>\n"+open("src/ohr_gram.js",encoding="utf8").read()+open("src/ohr_engine.js",encoding="utf8").read()+"// </ohr>\n"
if "// <ohr>" in s:
    a=s.index("// <ohr>");b=s.index("// </ohr>\n")+len("// </ohr>\n");s=s[:a]+block+s[b:]
else:
    rep("let lsSRBlocked=false;\n",block+"let lsSRBlocked=false;\n")
    rep("const STANDALONE=!window.claude;","const STANDALONE=!window.claude;\nconst OHRBASE=STANDALONE?\"ohr/\":\"\";   // PokeLearn-Ohr (reading recognizer on the device): only in the stand-alone app")
    # judge: a word the recognizer does not know is never judged; «unknown word heard» matches nothing else
    rep("function wordScoreFast(alts,e,eF,eK){let best=null;for(const a of alts){if(a===e)return 3;if(foldC(a)===eF)return 3;",
        "function wordScoreFast(alts,e,eF,eK){let best=null;for(const a of alts){if(a===e)return 3;if(a===OHRUNK){if(LSOOV.has(e))return 3;continue}if(foldC(a)===eF)return 3;")
    rep("if(w<N&&!LSFILL.test(tok[0]||\"\")&&","if(w<N&&!LSOOV.has(L.expN[w])&&!LSFILL.test(tok[0]||\"\")&&")
    # «Ich höre» line: show an unknown word as dots
    rep('''bh.innerHTML=w?`<span class="micdot"></span><span class="muted">Ich höre:</span> ${esc(w)}`''','''bh.innerHTML=w?`<span class="micdot"></span><span class="muted">Ich höre:</span> ${esc(w.replace(/xxunkxx/g,"…"))}`''')
    # stop / pause
    rep("function lsStopSR(L){L=L||LS;if(L&&L.sr){","function lsStopSR(L){L=L||LS;if(L&&L.ohr)ohrStop(L);if(L&&L.sr){")
    rep("L.muteUntil=Infinity;const live=!!L.sr;if(live){L.srPaused=true;lsStopSR(L)}","L.muteUntil=Infinity;const live=!!L.sr;if(L.ohr)L.ohr.mute=true;else if(live){L.srPaused=true;lsStopSR(L)}")
    rep("if(back)return;back=true;if(LS!==L)return;L.muteUntil=Date.now()+150;","if(back)return;back=true;if(LS!==L)return;if(L.ohr)L.ohr.mute=false;L.muteUntil=Date.now()+150;")
    # which recognizer listens
    rep("const lsLive=()=>STANDALONE&&!lsSRBlocked&&!!(window.SpeechRecognition||window.webkitSpeechRecognition);",
        "const lsEar=()=>OHR.on(LS&&LS.text&&LS.text.lang)&&OHR.st===\"ready\";   // the on-device recognizer is loaded and may be used for this text\nconst lsLive=()=>STANDALONE&&(lsEar()||!lsSRBlocked&&!!(window.SpeechRecognition||window.webkitSpeechRecognition));")
    rep("const ta=document.getElementById(\"lsDict\");if(ta&&!lsLive())ta.focus();lsStartSR();return}",
        "const ta=document.getElementById(\"lsDict\");if(ta&&!lsLive())ta.focus();lsListen(L);return}")
    rep("function lsStartSR(){","""// Start listening: the PokeLearn-Ohr when it is ready (and the text is German), otherwise the device's own recognizer.
function lsListen(L){L.eng="";LSOOV=new Set();if(lsEar()){L.eng="ohr";ohrStart(L).then(ok=>{if(!ok&&LS===L&&L.phase==="reading"&&!L.ohr){L.eng="";lsStartSR();lsMicUI();const ta=document.getElementById("lsDict");if(ta&&!lsLive())ta.focus()}});return}
 if(OHR.on(L.text.lang)&&OHR.st==="idle")OHR.load();lsStartSR()}
function lsStartSR(){""")
    rep("if(L.sr){lsStopSR(L);lsStartSR()}L.wst=[];L.pos=0;L._done=false;","if(L.ohr)ohrNewRec(L,L.ohr);else if(L.sr){lsStopSR(L);lsStartSR()}L.wst=[];L.pos=0;L._done=false;")
    rep("if(a===\"micResume\"){L.srNeedTap=false;lsNetFails=0;lsStartSR();lsMicUI();return}","if(a===\"micResume\"){L.srNeedTap=false;lsNetFails=0;lsListen(L);lsMicUI();return}")
    # the warning when something else than the text is heard
    rep('''wn.innerHTML=`Das Mikrofon versteht nicht ${ln}. ${L.srLive?"Bitte deutlich und nah am Gerät lesen.":''','''wn.innerHTML=L.eng==="ohr"?"Ich höre etwas anderes als den Text. Lies laut und nah am Gerät – oder tippe «Neu beginnen».":`Das Mikrofon versteht nicht ${ln}. ${L.srLive?"Bitte deutlich und nah am Gerät lesen.":''')
    # start card: choice of the recognizer
    rep('''  <label class="row" style="gap:8px;flex-wrap:wrap"><span>Mikrofon hört Deutsch als</span>''','''  ${OHRBASE?`<label class="row" style="gap:8px;flex-wrap:wrap"><span>Zuhören mit</span><select id="lsEng" style="width:auto;flex:1;min-width:200px"><option value="ohr" ${S.lsEngine!=="dev"?"selected":""}>PokeLearn-Ohr (kennt den Text, bleibt auf dem Gerät)</option><option value="dev" ${S.lsEngine==="dev"?"selected":""}>Erkennung des Geräts (Apple/Google)</option></select></label>
  <p class="muted" id="lsEngSt" style="margin:-4px 0 0;font-size:12px"></p>
  <label class="row" id="lsEarRow" style="gap:8px;flex-wrap:wrap" ${S.lsEngine==="dev"?"hidden":""}><span>Wie streng hört das Ohr?</span><select id="lsEar" style="width:auto;flex:1;min-width:200px">${[[0,"Grosszügig (im Zweifel richtig)"],[1,"Normal"],[2,"Streng (kleine Wörter genau)"]].map(([k,t])=>`<option value="${k}" ${(S.lsStrictEar??1)===k?"selected":""}>${t}</option>`).join("")}</select></label>`:""}
  <label class="row" id="lsDevRow" style="gap:8px;flex-wrap:wrap" ${OHRBASE&&S.lsEngine!=="dev"?"hidden":""}><span>Mikrofon hört Deutsch als</span>''')
    rep('''  <p class="muted" style="margin:-4px 0 0;font-size:12px">Ausprobieren: Wählt die Variante, bei der «Ich höre» die Wörter am genauesten zeigt.</p>\n''','')
    rep('''v.querySelector("#lsSRde").onchange=e=>{S.srLang2=Object.assign({},S.srLang2,{de:e.target.value});save()}}''','''v.querySelector("#lsSRde").onchange=e=>{S.srLang2=Object.assign({},S.srLang2,{de:e.target.value});save()};
 const eng=v.querySelector("#lsEng");if(eng){eng.onchange=e=>{S.lsEngine=e.target.value==="dev"?"dev":"ohr";save();v.querySelector("#lsEarRow").hidden=S.lsEngine==="dev";v.querySelector("#lsDevRow").hidden=S.lsEngine!=="dev";if(OHR.on("de")&&OHR.st==="idle")OHR.load();lsEngineUI()};
  v.querySelector("#lsEar").onchange=e=>{S.lsStrictEar=+e.target.value;save()};if(OHR.on("de")&&OHR.st==="idle")OHR.load();lsEngineUI()}}''')
    rep("Spracherkennung beim Lesen: Gerät bzw. Browser.","Spracherkennung beim Lesen: PokeLearn-Ohr auf dem Gerät – Vosk/Kaldi (Alpha Cephei, Apache-2.0) mit dem deutschen Modell «vosk-model-small-de» (Apache-2.0); Worthäufigkeiten nach wordfreq (R. Speer, CC BY-SA 4.0). Der Ton verlässt dabei das Gerät nicht. Wahlweise die Erkennung des Geräts bzw. Browsers (Apple/Google).")
open(p,"w",encoding="utf8").write(s);print("patched",len(s))
