# PokeLearn – Website

Die Lern-App PokeLearn als eigenständige Website (GitHub Pages): <https://domala-ch.github.io/pokelearn-lesen/>

* `index.html` – die App (gleicher Code wie die Version in der Claude-App; ohne Claude-App stellt der Block «STANDALONE»
  die Datenbank (IndexedDB im Browser), Claude (Anthropic API mit eigenem Schlüssel, Eltern › Claude) und die Preissuche bereit)
* `lesen/` – die Vorlese-Seite mit Mikrofon (wird von der Claude-App-Version verlinkt)
* `cards/`, `audio/` – Kartenkatalog, Fotos, Preisliste, aufgenommene Diktate
* `tools/update_prices.py` – wöchentliche Preisliste (GitHub Action «Weekly price list», schreibt `cards/prices.json`)
* `.github/workflows/pages.yml` – Deployment bei jedem Push auf `main`

Der Anthropic-Schlüssel wird nur im Browser des Geräts gespeichert (localStorage) und ausschliesslich an `api.anthropic.com` gesendet.
