# PokeLearn-Ohr – Werkstatt

Quellen und Prüfstand des Lese-Erkenners (`/ohr`). Forschungs-Skripte: die Pfade darin zeigen auf den Arbeitsordner, in dem
sie entstanden sind, und müssen beim Wiederverwenden angepasst werden.

**Quelltext** (steht zwischen `// <ohr>` und `// </ohr>` in der App; `patch_app.py` setzt ihn ein)
* `ohr_gram.js` – Grammatik aus dem Text: Wortformen des Erkenners, Verleser-Varianten, Alltagswörter, Gewichte
* `ohr_engine.js` – Mikrofon, Umrechnung auf 16 kHz mit Stimmhöhen-Anpassung, Erkenner, Rückfall auf die Geräte-Erkennung
* `make_model.py` – baut `ohr/de-model.tar.gz` und `ohr/de-lex.txt` aus dem offiziellen Vosk-Modell

**Prüfstand mit echten Stimmen** (Multilingual LibriSpeech Deutsch, 12 Sprecher, 168 Aufnahmen)
* `bench1.py` – Aufnahmen laden; Bedingungen: clean, child (+4 Halbtöne), child2 (+6), fast, noise (12 dB)
* `rg.py`, `mk_miscues.py` – Verleser simulieren: dieselbe Aufnahme, aber im «Text» steht an einer Stelle ein anderes Wort
  (kleines Grammatikwort, andere Endung, ähnliches Wort, ganz anderes Wort, Wort ausgelassen/eingefügt)
* `gen.js` – Grammatiken mit dem Code der App erzeugen · `dec3.py` – mit Vosk decodieren (alle 0.1 s der Zwischenstand)
* `sjudge.js` – den Verlauf durch die echte Lese-Logik der App spielen: falsche Stopps, erkannte Verleser, Verzögerung
* `sjudge2.js` – wie `sjudge.js`, dazu die Übereinstimmung von Farbe und Text des Erkenners (grün, obwohl nicht geschrieben / rot, obwohl
  geschrieben), ausgelassene und eingefügte Wörter · `dbg2.js` – der Verlauf einer einzelnen Aufnahme Schritt für Schritt
* `judge.js`, `evk.js` – Vergleich ohne Zeitverlauf, auch für offene Erkenner (Kroko, Whisper)

**Tests im Browser**
* `e2e1.js` – die App in Chromium, eine Aufnahme als Mikrofon (`--use-file-for-fake-audio-capture`); `mk_retry.py` baut Aufnahmen
  mit eingefügten falschen Wörtern (ein Fehlversuch / drei Fehlversuche)
* `cmp_unit.js` – der Vergleich gehört ↔ geschrieben als Wortströme mit eigener Uhr (ohne Ton): genaue Beurteilung, nicht Gehörtes,
  Korrekturen des Erkenners, Wörter in Teilen, Anlauf, Versuche, Weiterlesen, fremde Wörter, beständige Farben
* `mk_omit.py` – Aufnahmen mit einem herausgeschnittenen Wort (weitergelesen / zurückgegangen und nachgelesen)
* `ohr_unit.js`, `ohr_fallback.js`, `ohr_denied.js`, `ohr_guard.js` – Grammatik- und Beurteilungsregeln, Wahl des Erkenners,
  Rückfälle, Schutz bei abgebrochenem Laden · `rs_test.js` – Umrechnung auf 16 kHz

Ergebnisse (Einstellung «Normal», je rund 2 900 Wörter): siehe `ohr/README.md`.

## Lese-Aufnahmen (aus der App)

Im Elternbereich lässt sich «Lese-Aufnahmen» einschalten. Dann speichert die App bei jedem Lesen mit dem PokeLearn-Ohr auf dem Gerät
(IndexedDB `pokelearn-rec`, höchstens 30 Aufnahmen): `audio.wav` (16 kHz, mono, unverändert – die Tonhöhen-Anpassung fürs Ohr ist
nicht eingerechnet) und `info.json` (Text, Wer liest, Einstellungen, Endstand jedes Wortes und der Verlauf: was das Ohr wann
geschrieben hat `e:"h"`, Stand des Vergleichs `e:"j"` mit Stopp `[Wort, Versuch, nicht gehört, weitergelesen]`, Vorsagen `e:"sag"`,
Ohr an/aus). «Senden» packt eine oder alle Aufnahmen als zip.

* `rec_report.py <zip|ordner>` – ein unabhängiger Erkenner (Whisper small, kennt den Text nicht) hört mit: jeder Stopp wird als
  «wohl falscher Stopp» oder «wohl echter Verleser» eingeordnet, grün gelassene Wörter, die Whisper anders hörte, als «vielleicht
  übersehen»; dazu falsche Stopps pro 100 Wörter je Leser. Hinweise zum Nachhören, keine Gewissheit.
* `rec_replay.js <zip> [app.html]` – spielt den aufgezeichneten Verlauf durch die aktuelle Vergleichslogik und zeigt, wo sie anders
  entscheidet als auf dem Gerät: so wird eine Änderung an echten Lesungen geprüft, bevor sie ausgeliefert wird.
* `lrec_ui.js` – Test der Eltern-Karte, der Startkarte («Wer liest?») und der Anzeige beim Lesen.
