// PokeLearn-Stimme: Supertonic 3 (Supertone, OpenRAIL-M) running entirely on the device in a Web Worker.
// One model for German, French and English, five female (F1–F5) and five male (M1–M5) voices; reads any text.
// Weights are int8 (weight-only, ~100 MB together), downloaded once and kept in the browser cache.
const BASE = new URL("./", self.location.href).href;
const DIR = BASE + "st3/";
const STEPS = 5;   // 5 flow steps: same intelligibility as 8 in tests, ~40 % faster
let ort = null, cfg = null, idx = null, S = null, loading = null;
const styles = {};
const post = m => self.postMessage(m);

async function cache() { try { return await caches.open("pokelearn-st3-v1") } catch (e) { return null } }
async function get(url, onBytes) {
  const c = await cache();
  if (c) { const hit = await c.match(url); if (hit) { const b = new Uint8Array(await hit.arrayBuffer()); onBytes && onBytes(b.length, b.length); return b } }
  const r = await fetch(url); if (!r.ok) throw new Error("download " + r.status + " " + url.split("/").pop());
  const total = +r.headers.get("content-length") || 0; let got = 0; const parts = [];
  const rd = r.body.getReader(); for (; ;) { const { done, value } = await rd.read(); if (done) break; parts.push(value); got += value.length; onBytes && onBytes(got, total) }
  const b = new Uint8Array(got); let o = 0; for (const p of parts) { b.set(p, o); o += p.length }
  if (c) { try { await c.put(url, new Response(b)) } catch (e) { } }
  return b;
}
const SIZES = { duration_predictor: 3.7e6, text_encoder: 9.7e6, vector_estimator: 65.6e6, vocoder: 25.8e6 };
function load(prog) {
  if (S) return Promise.resolve();
  if (loading) return loading;
  loading = (async () => {
    if (!ort) { ort = await import(BASE + "ort/ort.wasm.min.mjs"); ort.env.wasm.wasmPaths = BASE + "ort/"; ort.env.wasm.numThreads = self.crossOriginIsolated ? Math.min(4, navigator.hardwareConcurrency || 1) : 1; ort.env.wasm.proxy = false }
    cfg = JSON.parse(new TextDecoder().decode(await get(DIR + "tts.json")));
    idx = JSON.parse(new TextDecoder().decode(await get(DIR + "unicode_indexer.json")));
    const names = ["duration_predictor", "text_encoder", "vector_estimator", "vocoder"], got = {}, all = Object.values(SIZES).reduce((a, b) => a + b, 0);
    const sess = {};
    for (const n of names) {
      const b = await get(DIR + n + ".onnx", g => { got[n] = g; prog("model", Object.values(got).reduce((a, x) => a + x, 0), all) });
      sess[n] = await ort.InferenceSession.create(b, { executionProviders: ["wasm"], graphOptimizationLevel: "all" });
    }
    S = sess; prog("ready", 1, 1);
  })().catch(e => { loading = null; throw e });
  return loading;
}
async function style(name) {
  if (styles[name]) return styles[name];
  const j = JSON.parse(new TextDecoder().decode(await get(DIR + "voices/" + name + ".json")));
  const flat = a => Float32Array.from(a.flat(Infinity));
  styles[name] = { ttl: new ort.Tensor("float32", flat(j.style_ttl.data), j.style_ttl.dims), dp: new ort.Tensor("float32", flat(j.style_dp.data), j.style_dp.dims) };
  return styles[name];
}
// same text clean-up as the reference implementation, plus Swiss/French quotes and a few symbols children's texts use
function prep(text, lang) {
  let t = String(text).normalize("NFKD");
  t = t.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, "");
  const R = { "–": "-", "‑": "-", "—": "-", "_": " ", "“": '"', "”": '"', "„": '"', "«": '"', "»": '"', "‹": "'", "›": "'", "‘": "'", "’": "'", "´": "'", "`": "'", "[": " ", "]": " ", "|": " ", "/": " ", "#": " ", "→": " ", "←": " " };
  for (const [k, v] of Object.entries(R)) t = t.split(k).join(v);
  t = t.replace(/[♥☆♡©\\]/g, "");
  t = t.replace(/ ,/g, ",").replace(/ \./g, ".").replace(/ !/g, "!").replace(/ \?/g, "?").replace(/ ;/g, ";").replace(/ :/g, ":").replace(/ '/g, "'");
  t = t.replace(/" +/g, '"').replace(/\s+/g, " ").trim();
  while (t.includes('""')) t = t.replace('""', '"');
  if (!/[.!?;:,'"')\]}…»]$/.test(t)) t += ".";
  return `<${lang}>` + t + `</${lang}>`;
}
function randn(n) { const o = new Float32Array(n); for (let i = 0; i < n; i += 2) { const u1 = Math.max(1e-10, Math.random()), u2 = Math.random(), r = Math.sqrt(-2 * Math.log(u1)); o[i] = r * Math.cos(2 * Math.PI * u2); if (i + 1 < n) o[i + 1] = r * Math.sin(2 * Math.PI * u2) } return o }
async function synth(text, lang, voice, speed) {
  await load(() => { });
  const st = await style(voice);
  const p = prep(text, lang), ids = Array.from(p, ch => idx[ch.charCodeAt(0)] ?? 0), L = ids.length;
  const textIds = new ort.Tensor("int64", BigInt64Array.from(ids.map(BigInt)), [1, L]);
  const textMask = new ort.Tensor("float32", new Float32Array(L).fill(1), [1, 1, L]);
  const dp = await S.duration_predictor.run({ text_ids: textIds, style_dp: st.dp, text_mask: textMask });
  const dur = dp.duration.data[0] / (speed || 1);
  const te = await S.text_encoder.run({ text_ids: textIds, style_ttl: st.ttl, text_mask: textMask });
  const sr = cfg.ae.sample_rate, chunk = cfg.ae.base_chunk_size * cfg.ttl.chunk_compress_factor, ld = cfg.ttl.latent_dim * cfg.ttl.chunk_compress_factor;
  const wavLen = Math.floor(dur * sr), T = Math.floor((wavLen + chunk - 1) / chunk);
  let x = randn(ld * T);
  const lmask = new ort.Tensor("float32", new Float32Array(T).fill(1), [1, 1, T]);
  const tot = new ort.Tensor("float32", Float32Array.from([STEPS]), [1]);
  for (let s = 0; s < STEPS; s++) {
    const r = await S.vector_estimator.run({ noisy_latent: new ort.Tensor("float32", x, [1, ld, T]), text_emb: te.text_emb, style_ttl: st.ttl, text_mask: textMask, latent_mask: lmask, total_step: tot, current_step: new ort.Tensor("float32", Float32Array.from([s]), [1]) });
    x = Float32Array.from(r.denoised_latent.data);
  }
  const v = await S.vocoder.run({ latent: new ort.Tensor("float32", x, [1, ld, T]) });
  let a = v.wav_tts.data; a = a.subarray(0, Math.min(a.length, wavLen + Math.floor(sr * .05)));
  // trim silence at the ends (the app controls the pauses), with a short fade so nothing clicks
  let s0 = 0, e0 = a.length; const th = .006; while (s0 < e0 && Math.abs(a[s0]) < th) s0++; while (e0 > s0 && Math.abs(a[e0 - 1]) < th) e0--;
  s0 = Math.max(0, s0 - Math.floor(sr * .03)); e0 = Math.min(a.length, e0 + Math.floor(sr * .08));
  const out = Float32Array.from(a.subarray(s0, e0)); const f = Math.min(400, out.length >> 2);
  for (let i = 0; i < f; i++) { out[i] *= i / f; out[out.length - 1 - i] *= i / f }
  return { audio: out, sr };
}
// one job at a time; things asked for now go before warm-ups
const queue = []; let busy = false, seq = 0; const done = new Map(); let doneBytes = 0;
const keyOf = j => `${j.lang}|${j.voice}|${j.speed}|${j.text}`;
function remember(k, r) { done.set(k, r); doneBytes += r.audio.length * 4; while (doneBytes > 80e6 && done.size) { const f = done.keys().next().value; doneBytes -= done.get(f).audio.length * 4; done.delete(f) } }
async function pump() {
  if (busy) return; busy = true;
  while (queue.length) {
    queue.sort((a, b) => (b.prio - a.prio) || (a.seq - b.seq));
    const j = queue.shift(), k = keyOf(j);
    try {
      let r = done.get(k);
      if (!r) { if (!S) await load((stage, g, t) => post({ type: "progress", stage, got: g, total: t })); r = await synth(j.text, j.lang, j.voice, j.speed); remember(k, r) }
      for (const id of j.ids) post({ type: "audio", id, audio: r.audio, sr: r.sr });
    } catch (e) { for (const id of j.ids) post({ type: "error", id, message: String(e && e.message || e) }) }
  }
  busy = false;
}
self.onmessage = ev => {
  const m = ev.data || {};
  if (m.type === "synth" || m.type === "warm") {
    const speed = Math.round((m.speed || 1) * 100) / 100, prio = m.type === "synth" ? 2 : (m.prio || 0), voice = m.voice || "F1";
    for (const it of (m.items || [{ text: m.text, id: m.id }])) {
      const j = { text: String(it.text || "").trim(), lang: m.lang, voice, speed, prio, seq: seq++, ids: it.id == null ? [] : [it.id] };
      if (!j.text) { if (it.id != null) post({ type: "audio", id: it.id, audio: new Float32Array(0), sr: 44100 }); continue }
      const k = keyOf(j), hit = done.get(k);
      if (hit) { for (const id of j.ids) post({ type: "audio", id, audio: hit.audio, sr: hit.sr }); continue }
      const q = queue.find(x => keyOf(x) === k); if (q) { q.prio = Math.max(q.prio, prio); q.ids.push(...j.ids); continue }
      queue.push(j);
    }
    pump();
  } else if (m.type === "load") load((stage, g, t) => post({ type: "progress", stage, got: g, total: t })).then(() => post({ type: "loaded" }), e => post({ type: "loaderror", message: String(e && e.message || e) }));
};
