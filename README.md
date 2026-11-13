# PokeLearn – Website

Die Lern-App PokeLearn als eigenständige Website (GitHub Pages): <https://domala-ch.github.io/pokelearn-lesen/>

* `index.html` – die App (gleicher Code wie die Version in der Claude-App). Ohne Claude-App stellt der Block «STANDALONE»
  die Datenbank (IndexedDB im Browser), Claude (Anthropic API mit eigenem Schlüssel, Eltern › Claude) und die Preissuche bereit.
* `lesen/` – die Vorlese-Seite mit Mikrofon (wird von der Claude-App-Version verlinkt)
* `cards/` – Kartenkatalog, Fotos, Preisliste
* `audio/v/` – fertig aufgenommene Diktate (Qwen3-TTS, Apache-2.0), erstellt von der Action «Diktat-Stimme»
  (`tools/voice_jobs.py`, `tools/voice_render.py`, `tools/voice_clean.py`, Stimmen in `tools/voices/`)
* `voice/` – Stimme auf dem Gerät für noch nicht aufgenommene Texte (Supertonic, OpenRAIL-M; Lizenz in `voice/st3/`)
* `tools/update_prices.py` – wöchentliche Preisliste (Action «Weekly price list», schreibt `cards/prices.json`)
* `.github/workflows/pages.yml` – Deployment bei jedem Push auf `main`

Der Anthropic-Schlüssel wird nur im Browser des Geräts gespeichert und ausschliesslich an `api.anthropic.com` gesendet;
im Abgleich-Gist liegt er nur verschlüsselt.

PokeLearn ist ein privates Lernprojekt und steht in keiner Verbindung zu Nintendo, Creatures, GAME FREAK oder
The Pokémon Company. Pokémon und die Namen der Karten und Produkte sind Marken ihrer Inhaber.
