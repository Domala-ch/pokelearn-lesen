# PokeLearn-Ohr – Spracherkennung beim Lesen, direkt auf dem Gerät

Beim lauten Lesen hört die App mit einem eigenen Erkenner zu, der **den Text kennt**. Der Ton verlässt das Gerät nicht.

| Datei | Inhalt | Lizenz |
|---|---|---|
| `vosk.js` | [vosk-browser](https://github.com/ccoreilly/vosk-browser) 0.0.8 – Vosk/Kaldi als WebAssembly, läuft in einem Web Worker | Apache-2.0 |
| `de-model.tar.gz` | deutsches Akustikmodell [vosk-model-small-de-0.15](https://alphacephei.com/vosk/models) (Alpha Cephei). Ohne das eingebaute Sprachmodell (`Gr.fst` ist leer, die Wortliste liegt als `graph/words.txt` bei), weil die App für jeden Text eine eigene Grammatik baut | Apache-2.0, siehe `LICENSE-vosk-model.txt` |
| `de-lex.txt` | die Wörter, die das Modell kennt, nach Häufigkeit sortiert (erste Zeile: Anzahl häufiger Wörter). Häufigkeiten nach [wordfreq](https://github.com/rspeer/wordfreq) (Robyn Speer) | CC BY-SA 4.0 |

## So arbeitet es

1. **Grammatik aus dem Text.** Der Erkenner hört nur auf die Wörter des Textes (als Wortfolge mit hohem Gewicht), dazu auf
   die Verleser, die beim Lesen wirklich vorkommen: kleine Grammatikwörter (ein/einen, den/dem, war/waren), ähnliche Wörter
   (Tasche/Tische), andere Endungen – und eine Schleife mit Alltagswörtern für «etwas ganz anderes gelesen».
   Ein Verleser wird nur gemeldet, wenn der Klang klar dafür spricht (Gewicht Text : Verleser = 100 : 1 bis 300 : 1, einstellbar).
2. **Eigenes Mikrofon.** Der Ton wird im Browser auf 16 kHz umgerechnet. Hohe Kinderstimmen werden leicht tiefer abgespielt
   (aus der gemessenen Stimmhöhe), damit sie den Erwachsenenstimmen gleichen, mit denen das Modell gelernt hat.
3. **Sofort beurteilen.** Etwa 0.2 s nach einem Wort steht es beim Erkenner; richtige Wörter werden sofort grün,
   ein falsches wird rot, sobald es eine Viertelsekunde stehen geblieben ist.

Gemessen mit echten Stimmen (Hörbuch-Aufnahmen aus «Multilingual LibriSpeech», 12 Sprecherinnen und Sprecher, rund 2 900 Wörter
pro Durchgang, Einstellung «Normal»), im gleichen Ablauf wie in der App:

* etwa **0.5 falsche Stopps pro 100 richtig gelesene Wörter** (höhere, kinderähnliche Stimmen und Lärm: etwa 1 pro 100),
* erkannt werden rund 64 % der Verleser bei kleinen Grammatikwörtern, 76 % bei ähnlichen Wörtern und 87 % bei ganz anderen Wörtern
  («Streng»: 77 % der kleinen Wörter, dafür etwa 1.1 falsche Stopps pro 100),
* der Stopp kommt im Mittel 0.4 s nach dem Wort (9 von 10 innerhalb von 0.6 s).

Zum Vergleich: Offene Erkenner (Kroko-Zipformer, Whisper small), mit derselben Wort-Beurteilung der App ausgewertet, markieren auf
denselben Aufnahmen 4.6 bis 7 von 100 richtig gelesenen Wörtern als Fehler; das Ohr 0.4.
Mit Kinderstimmen ist das noch nicht gemessen (es gibt keine frei verfügbaren Aufnahmen); dort wird es etwas schlechter sein.

Fällt das Ohr aus (Laden misslingt, Gerät zu langsam, kein Ton), hört automatisch die Erkennung des Geräts zu.
