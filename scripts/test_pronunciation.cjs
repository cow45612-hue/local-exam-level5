const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");

const source = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");
const start = source.indexOf("// Shared Audio element");
const end = source.indexOf("// Subview Switcher", start);
const calls = [];
const alerts = [];
const pending = [];
let voices = [
  { name: "Microsoft Guy Online (Natural)", lang: "en-US" },
  { name: "Microsoft Jenny Online (Natural)", lang: "en-US" },
];
class Audio {
  constructor() { this.preservesPitch = false; }
  pause() {}
  play() {
    calls.push({ src: this.src, rate: this.playbackRate, preservesPitch: this.preservesPitch });
    return new Promise((resolve, reject) => pending.push({ resolve, reject }));
  }
}
const context = vm.createContext({
  Audio,
  document: { addEventListener() {} },
  TSMC_WORDS: [{ id: 10, word: "AI" }, { id: 1, word: "ability" }],
  TSMC_SPEECH_OVERRIDES: { AI: "A I" },
  SpeechSynthesisUtterance: class { constructor(text) { this.text = text; } },
  setTimeout,
  window: {
    HUMAN_RECORDINGS: {
      active: { file: "./audio-human/6.mp3", artist: "Dvortygirl" },
      ability: { file: "./audio-human/1.mp3", artist: "Dvortygirl" },
    },
    alert: (text) => alerts.push(text),
    speechSynthesis: {
      getVoices: () => voices,
      cancel() {},
      speak: (utterance) => calls.push(utterance),
    },
  },
});
vm.runInContext(source.slice(start, end), context);

(async () => {
  vm.runInContext('playNaturalWordAudio({ id: 10, word: "AI" });', context);
  assert.equal(calls.length, 0, "missing human audio must not play synthetic audio");
  assert.match(alerts.pop(), /真人錄音/);
  vm.runInContext('playNaturalWordAudio({ id: 1, word: "ability" });', context);
  assert.equal(calls.at(-1).src, "./audio-human/1.mp3");
  vm.runInContext('playNaturalWordAudio({ id: 1, word: "ability" }, true);', context);
  assert.equal(calls.at(-1).src, "./audio-human/1.mp3");
  assert.equal(calls.at(-1).rate, 0.72);
  assert.equal(calls.at(-1).preservesPitch, true);
  pending[0].reject(new Error("old request failed"));
  await Promise.resolve();
  assert.equal(alerts.length, 0, "stale failures must not interrupt the new word");

  vm.runInContext('playNaturalWordAudio({ id: 6, word: "active" });', context);
  assert.equal(calls.at(-1).src, "./audio-human/6.mp3");
  vm.runInContext('playNaturalWordAudio({ id: 6, word: "active" }, true);', context);
  assert.equal(calls.at(-1).src, "./audio-human/6.mp3");
  assert.equal(calls.at(-1).rate, 0.72);

  vm.runInContext('speakOptimizedEnglishSpeech("hello");', context);
  assert.match(calls.at(-1).voice.name, /Jenny/);
  voices = [{ name: "Samantha", lang: "en-US" }, ...voices];
  vm.runInContext('updateCachedVoices(); speakOptimizedEnglishSpeech("world");', context);
  assert.match(calls.at(-1).voice.name, /Jenny/, "voice must remain pinned");

  voices = [{ name: "Microsoft Guy Online (Natural)", lang: "en-US" }];
  vm.runInContext('cachedBestEnVoice = null; speakOptimizedEnglishSpeech("hello");', context);
  assert.equal(alerts.length, 1, "must not silently switch to a male voice");

  const vocabulary = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "tsmc-vocabulary.json"), "utf8"));
  for (const item of vocabulary) {
    const file = path.join(__dirname, "..", "audio", `${item.id}.mp3`);
    assert.ok(fs.statSync(file).size > 1000, `Missing audio: ${item.word}`);
  }
  const records = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "audio-human", "sources.json"), "utf8"));
  const crypto = require("node:crypto");
  for (const record of records) {
    assert.equal(record.accent, "US", `Non-US recording must not be installed: ${record.word}`);
    assert.ok(vocabulary.some((word) => word.id === record.id && word.word === record.word));
    assert.ok(record.artist && record.license && record.page);
    assert.match(record.page, /^https:\/\/commons\.wikimedia\.org\//);
    for (const [ext, field] of [["mp3", "sha256"], [record.originalExtension || "ogg", "originalSha256"]]) {
      const bytes = fs.readFileSync(path.join(__dirname, "..", "audio-human", `${record.id}.${ext}`));
      assert.equal(crypto.createHash("sha256").update(bytes).digest("hex"), record[field]);
    }
  }
  console.log(`PASS: human routing, no synthetic fallback, slow playback, stale cancellation; ${records.length} recordings with attribution and verified hashes`);
})().catch((error) => { console.error(error); process.exitCode = 1; });
