#!/bin/bash
# A/B: version that worked (good) vs. now (rec off / rec on), same audio, one run at a time
cd "$(dirname "$0")"
T1="$(cat e2e/retry.txt)"
T2="Im Klassenlager wartet auf die sechste Klasse ein besonderes Abenteuer: ein Orientierungslauf. Jede Gruppe erhält eine Karte und einen Kompass. Auf dem Weg müssen die Kinder mehrere Posten finden."
run(){ # name wav text secs
 for v in good now recon; do js=e2e_good.js; [ $v = now ] && js=e2e1.js; [ $v = recon ] && js=e2e_recon.js
  out=$(timeout 200 node $js "$PWD/$2" "$3" $4 2>&1); fin=$(echo "$out" | grep '"ph"' | tail -1); lag=$(echo "$out" | grep -o '"lag":[0-9]*' | sed 's/"lag"://' | sort -n | tail -1)
  st=$(echo "$fin" | python3 -c "import sys,json;d=json.loads(sys.stdin.read());w=d['wst'].split();print('pos',d['pos'],'/',d['N'],'fixed',d['fixed'],'given',d['given'],'red',[x for x in w if '✗' in x or '!' in x or '∅' in x][:8])" 2>/dev/null)
  echo "$1 $v maxlag=${lag}ms $st"; done; }
for k in closed near gross; do python3 -c "import json;d=json.load(open('e2e/m_$k.json'));open('/tmp/m_$k.txt','w').write(d['text'])"; done
run a0 e2e/a0.wav "$T1" 95
run a0_child e2e/a0_child.wav "$T1" 95
run retry3 e2e/retry3.wav "$T1" 50
run omit_back e2e/omit_back.wav "$T1" 50
run m_closed e2e/m_closed.wav "$(cat /tmp/m_closed.txt)" 34
run m_near e2e/m_near.wav "$(cat /tmp/m_near.txt)" 34
run m_gross e2e/m_gross.wav "$(cat /tmp/m_gross.txt)" 34
run long e2e2/long.wav "$T2" 32
run bad2 e2e2/bad2.wav "$T2" 36
echo "== done"
