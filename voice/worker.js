// PokeLearn live voice – runs in a Web Worker so the app stays responsive while the model computes.
// Kokoro-82M (Apache-2.0) for French/English and the Kikiri German voices (Apache-2.0), int8 ONNX, onnxruntime-web (WebAssembly),
// phonemes from espeak-ng. The first use downloads the model once (~85 MB per language) and keeps it in the browser cache.
const BASE = new URL("./", self.location.href).href;
const VOICES = {
  "de|f": { model: "vic", voice: "de_f", espeak: "de", g2p: "misaki" },
  "de|m": { model: "mar", voice: "de_m", espeak: "de", g2p: "misaki" },
  "fr|f": { model: "kok", voice: "fr_f", espeak: "fr-fr", g2p: "plain" },
  "fr|m": { model: "kok", voice: "fr_m", espeak: "fr-fr", g2p: "plain" },
  "en|f": { model: "kok", voice: "en_f", espeak: "en-gb", g2p: "plain" },
  "en|m": { model: "kok", voice: "en_m", espeak: "en-gb", g2p: "plain" },
};
const PARTS = { kok: 2, vic: 2, mar: 2 };
let ort = null, esp = null, vocab = null;
const sessions = {}, voices = {}, loading = {};
const E2M = Object.entries({ "a^ɪ": "I", "a^ʊ": "W", "d^z": "ʣ", "d^ʒ": "ʤ", "e^ɪ": "A", "o^ʊ": "O", "ə^ʊ": "Q", "s^s": "S", "t^s": "ʦ", "t^ʃ": "ʧ", "ɔ^ɪ": "Y" }).sort((a, b) => a[0] < b[0] ? -1 : 1);
const post = m => self.postMessage(m);
async function cache() { try { return await caches.open("pokelearn-voice-v2") } catch (e) { return null } }
async function cachedFetch(url, onBytes) {
  const c = await cache();
  if (c) { const hit = await c.match(url); if (hit) { const b = new Uint8Array(await hit.arrayBuffer()); onBytes && onBytes(b.length, b.length); return b } }
  const r = await fetch(url); if (!r.ok) throw new Error("download " + r.status + " " + url.split("/").pop());
  const total = +r.headers.get("content-length") || 0; let got = 0; const chunks = [];
  const rd = r.body.getReader(); for (; ;) { const { done, value } = await rd.read(); if (done) break; chunks.push(value); got += value.length; onBytes && onBytes(got, total) }
  const body = new Uint8Array(got); let o = 0; for (const ch of chunks) { body.set(ch, o); o += ch.length }
  if (c) { try { await c.put(url, new Response(body)) } catch (e) { } }
  return body;
}
async function libs(prog) {
  if (!ort) { ort = await import(BASE + "ort/ort.wasm.min.mjs"); ort.env.wasm.wasmPaths = BASE + "ort/"; ort.env.wasm.numThreads = 1; ort.env.wasm.proxy = false }
  if (!esp) {
    const mod = (await import(BASE + "espeak/espeak-ng.js")).default;
    const gz = await cachedFetch(BASE + "espeak/espeak-ng.wasm.gz", (g, t) => prog("espeak", g, t));
    const raw = await new Response(new Blob([gz]).stream().pipeThrough(new DecompressionStream("gzip"))).arrayBuffer();
    const wmod = await WebAssembly.compile(raw);
    esp = args => mod({ ...args, instantiateWasm: (imports, cb) => { WebAssembly.instantiate(wmod, imports).then(i => cb(i, wmod)); return {} } });
  }
  if (!vocab) vocab = JSON.parse(new TextDecoder().decode(await cachedFetch(BASE + "tts/vocab.json")));
}
async function load(key, prog) {
  const V = VOICES[key]; if (!V) throw new Error("no voice " + key);
  await libs(prog);
  if (!voices[V.voice]) { const b = await cachedFetch(BASE + "tts/" + V.voice + ".bin"); voices[V.voice] = new Float32Array(b.buffer, b.byteOffset, b.byteLength / 4) }
  if (sessions[V.model]) return V;
  if (!loading[V.model]) loading[V.model] = (async () => {
    const n = PARTS[V.model], parts = [], got = new Array(n).fill(0), tot = new Array(n).fill(0);
    for (let i = 0; i < n; i++) parts.push(await cachedFetch(BASE + "models/" + V.model + "." + i + ".bin", (g, t) => { got[i] = g; tot[i] = t || 41500000; prog("model", got.reduce((a, b) => a + b, 0), tot.reduce((a, b) => a + b, 0)) }));
    let total = 0; for (const p of parts) total += p.length;
    const buf = new Uint8Array(total); let o = 0; for (const p of parts) { buf.set(p, o); o += p.length } parts.length = 0;
    prog("compile", 0, 0);
    sessions[V.model] = await ort.InferenceSession.create(buf, { executionProviders: ["wasm"], graphOptimizationLevel: "all" });
    prog("ready", 1, 1);
  })().catch(e => { delete loading[V.model]; throw e });
  await loading[V.model]; return V;
}
// espeak-ng (CLI build) puts each clause on its own line and drops punctuation: restore the marks, as phonemizer does
async function phonemes(text, V) {
  let t = String(text).replace(/\s+/g, " ").trim();
  if (V.g2p === "misaki") t = t.replace(/«/g, "“").replace(/»/g, "”").replace(/\(/g, "«").replace(/\)/g, "»");
  const marks = t.match(/[.,!?;:]+/g) || [];
  const e = await esp({ arguments: ["--phonout", "out", "-q", "--ipa", ...(V.g2p === "misaki" ? ["--tie=^"] : []), "-v", V.espeak, t], print: () => { }, printErr: () => { } });
  const lines = e.FS.readFile("out", { encoding: "utf8" }).split("\n").map(x => x.trim()).filter(Boolean);
  let ps = lines.map((l, i) => l + (marks[i] || (i < lines.length - 1 ? "," : ""))).join(" ");
  ps = ps.replace(/\([a-z-]{2,8}\)/g, "");
  if (V.g2p === "misaki") { for (const [a, b] of E2M) ps = ps.split(a).join(b); ps = ps.replace(/\^/g, "").replace(/-/g, "") }
  return ps.trim();
}
async function synth(text, lang, gender, speed, prog) {
  const V = await load(lang + "|" + gender, prog);
  const ps = await phonemes(text, V);
  const toks = [...ps].map(c => vocab[c]).filter(v => v != null).slice(0, 508);
  if (!toks.length) return new Float32Array(0);
  const v = voices[V.voice], row = Math.min(toks.length - 1, 509) * 256;
  const feeds = { tokens: new ort.Tensor("int64", BigInt64Array.from([0, ...toks, 0].map(BigInt)), [1, toks.length + 2]), style: new ort.Tensor("float32", v.slice(row, row + 256), [1, 256]), speed: new ort.Tensor("float32", Float32Array.from([speed || 1]), [1]) };
  const out = await sessions[V.model].run(feeds);
  // trim leading/trailing silence a little (keeps dictation pauses in the app's hands)
  let a = out.audio.data, s = 0, e = a.length; const th = 0.004;
  while (s < e && Math.abs(a[s]) < th) s++; while (e > s && Math.abs(a[e - 1]) < th) e--;
  s = Math.max(0, s - 1200); e = Math.min(a.length, e + 2400);
  return Float32Array.from(a.subarray(s, e));
}
// one job at a time; explicit requests go before warm-up requests
const queue = []; let busy = false; const done = new Map(); let doneBytes = 0;
const keyOf = j => `${j.lang}|${j.gender}|${j.speed}|${j.text}`;
function remember(k, a) { done.set(k, a); doneBytes += a.length * 4; while (doneBytes > 60e6 && done.size) { const f = done.keys().next().value; doneBytes -= done.get(f).length * 4; done.delete(f) } }
async function pump() {
  if (busy) return; busy = true;
  while (queue.length) {
    queue.sort((a, b) => (b.prio - a.prio) || (a.seq - b.seq));
    const j = queue.shift(), k = keyOf(j);
    try {
      let a = done.get(k);
      if (!a) { a = await synth(j.text, j.lang, j.gender, j.speed, (stage, g, t) => post({ type: "progress", lang: j.lang, gender: j.gender, stage, got: g, total: t })); remember(k, a) }
      for (const id of j.ids) post({ type: "audio", id, audio: a, sr: 24000 });
    } catch (e) { for (const id of j.ids) post({ type: "error", id, message: String(e && e.message || e) }) }
  }
  busy = false;
}
let seq = 0;
self.onmessage = ev => {
  const m = ev.data || {};
  if (m.type === "synth" || m.type === "warm") {
    const speed = Math.round((m.speed || 1) * 100) / 100; const prio = m.type === "synth" ? 2 : (m.prio || 0);
    const items = m.items || [{ text: m.text, id: m.id }];
    for (const it of items) {
      const j = { text: String(it.text || "").trim(), lang: m.lang, gender: m.gender, speed, prio, seq: seq++, ids: it.id == null ? [] : [it.id] };
      if (!j.text) { if (it.id != null) post({ type: "audio", id: it.id, audio: new Float32Array(0), sr: 24000 }); continue }
      const k = keyOf(j), hit = done.get(k);
      if (hit) { for (const id of j.ids) post({ type: "audio", id, audio: hit, sr: 24000 }); continue }
      const q = queue.find(x => keyOf(x) === k); if (q) { q.prio = Math.max(q.prio, prio); q.ids.push(...j.ids); continue }
      queue.push(j);
    }
    pump();
  } else if (m.type === "load") { load(m.lang + "|" + m.gender, (stage, g, t) => post({ type: "progress", lang: m.lang, gender: m.gender, stage, got: g, total: t })).then(() => post({ type: "loaded", lang: m.lang, gender: m.gender }), e => post({ type: "loaderror", lang: m.lang, gender: m.gender, message: String(e && e.message || e) })) }
  else if (m.type === "ping") post({ type: "pong" });
};
