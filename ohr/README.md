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

## Der Vergleich: gehört ↔ geschrieben

Die Zeile «Ich höre» zeigt, was das Ohr geschrieben hat; jedes Wort darin trägt die Farbe seines Urteils. Die Regeln:

* **Grün** wird ein Wort nur, wenn das Ohr genau dieses Wort geschrieben hat – oder eine Schreibweise, die gleich klingt (seid/seit, Rad/Rat).
  Eine andere Endung (kleine/kleinen, erzählte/erzählt), ein ähnliches Wort oder Mutter/Mütter ist ein anderes Wort: **rot**, der Text wartet.
* **Nicht gehört ist nie grün.** Fehlt ein längeres Wort (ab vier Buchstaben, kein kleines Funktionswort), hält der Text dort an wie bei
  einem Verleser («… nicht gehört»). Fehlt ein kleines Wort, wird es grau gepunktet gezeigt und zählt nicht als Fehler – solche Wörter
  verliert ein Erkenner ab und zu. Namen, die das Ohr nicht kennt, Zahlen und die ersten zwei Wörter halten nie an.
* **Das Ohr darf sich korrigieren.** Ändert es ein schon geschriebenes Wort, werden alle Entscheidungen, die dieses Wort gesehen haben,
  zurückgenommen und neu getroffen: Ein Stopp auf eine erste Vermutung verschwindet wieder, die Farben passen immer zu den Wörtern in
  «Ich höre». Folgen direkt nach einem Stopp Wörter, die zeigen, dass das Wort doch da war, wird er ebenfalls zurückgenommen.
  Was acht Wörter zurückliegt und zwei Sekunden unverändert war, behält seine Farbe – ein grünes Wort wird nicht nachträglich rot.
* **Lange Wörter in Teilen** («hallen bad», «aus marschier end») gelten als das Wort; nach dem ersten Teil wartet der Vergleich bis 1.5 s.
* **Nach einem Stopp:** Anlauf nehmen («der Hund ging» für «ging», bis zwölf Wörter zurück) ist kein Versuch. Wörter in schneller Folge
  sind zusammen ein Versuch. Wer einfach weiterliest, bekommt das Wort nach fünf Wörtern rot, und alles danach wird normal beurteilt.
  Nach dem dritten Fehlversuch sagt die App das Wort.
* **Ein einzelnes fremdes Wort am Schluss** (oft ein Geräusch) hält erst an, wenn 1.2 s nichts folgt oder das nächste Wort es bestätigt.

Mit der Erkennung des Geräts (Apple/Google) bleibt der Vergleich nachsichtiger (Endungen langer Wörter, ein einzelnes fehlendes Wort),
weil sie den Text nicht kennt und öfter danebenliegt.

## Auf die Stimmen der Familie abstimmen

«Wer liest?» auf der Lese-Startkarte (Kind / Eltern): das Ohr merkt sich die Tonhöhe der Stimme je Leser und beginnt beim nächsten
Mal gleich mit der passenden Einstellung. Mit eingeschalteten **Lese-Aufnahmen** (Elternbereich) werden Lesungen auf dem Gerät
gespeichert; gesendet und ausgewertet (`tools/ohr/rec_report.py`, `rec_replay.js`) zeigen sie, wo das Ohr bei welcher Stimme zu
streng oder zu nachsichtig ist.

## Gemessen

Echte Stimmen (Hörbuch-Aufnahmen aus «Multilingual LibriSpeech», 12 Sprecherinnen und Sprecher, rund 2 900 Wörter pro Durchgang,
Einstellung «Normal»), im gleichen Ablauf wie in der App:

* etwa **0.4 falsche Stopps pro 100 richtig gelesene Wörter** (höhere, kinderähnliche Stimmen und Lärm: etwa 1 pro 100),
* erkannt werden rund 68 % der Verleser bei kleinen Grammatikwörtern, 78 % bei ähnlichen Wörtern, 96 % bei ganz anderen Wörtern
  und 94 % der ausgelassenen längeren Wörter,
* der Stopp kommt im Mittel 0.4 s nach dem Wort (9 von 10 innerhalb von 0.7 s),
* Übereinstimmung von Farbe und Text des Ohrs (alle Durchgänge, je 100 Wörter): grün, obwohl das Ohr das Wort nicht geschrieben hat
  0.04 (vorher 0.34; mit ausgelassenen Wörtern 1.2); rot, obwohl es das Wort geschrieben hat 0.02 (vorher 0.25). Der Rest sind Wörter,
  die das Ohr beim Zuhören richtig zeigte und erst im Schlusstext eines langen Satzes anders schrieb.

Zum Vergleich: Offene Erkenner (Kroko-Zipformer, Whisper small), mit der Wort-Beurteilung der App ausgewertet, markieren auf
denselben Aufnahmen 4.6 bis 7 von 100 richtig gelesenen Wörtern als Fehler.
Mit Kinderstimmen ist das noch nicht gemessen (es gibt keine frei verfügbaren Aufnahmen); dort wird es etwas schlechter sein.

Fällt das Ohr aus (Laden misslingt, Gerät zu langsam, kein Ton), hört automatisch die Erkennung des Geräts zu.
