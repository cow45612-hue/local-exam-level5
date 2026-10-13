const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const app = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");
const audioStart = app.indexOf("// Shared Audio element");
const audioEnd = app.indexOf("// Subview Switcher", audioStart);
const autoplayStart = app.indexOf("function stopTsmcAutoplay()");
const autoplayEnd = app.indexOf("// 15-Question Exam Simulator", autoplayStart);
assert.ok(audioStart >= 0 && audioEnd > audioStart);
assert.ok(autoplayStart >= 0 && autoplayEnd > autoplayStart);
const code = app.slice(audioStart, audioEnd) + "\n" + app.slice(autoplayStart, autoplayEnd);

function setup() {
  let activeAudio;
  const timers = new Map();
  let sequence = 0;
  class Audio {
    constructor() {
      activeAudio = this;
      this.listeners = new Map();
      this.paused = true;
      this.ended = false;
      this.error = null;
    }
    addEventListener(type, fn) {
      const list = this.listeners.get(type) || [];
      list.push(fn);
      this.listeners.set(type, list);
    }
    removeEventListener(type, fn) {
      this.listeners.set(type, (this.listeners.get(type) || []).filter((item) => item !== fn));
    }
    emit(type) {
      for (const fn of [...(this.listeners.get(type) || [])]) fn();
    }
    play() {
      this.paused = false;
      return Promise.resolve();
    }
    pause() {
      if (!this.paused) {
        this.paused = true;
        this.emit("pause");
      }
    }
  }
  const context = vm.createContext({
    Audio,
    document: { addEventListener() {}, querySelector() { return null; } },
    window: {
      HUMAN_RECORDINGS: { ability: { file: "./audio-human/1.mp3" } },
      EXAMPLE_RECORDINGS: {},
      speechSynthesis: { getVoices: () => [], cancel() {}, speak() {} },
      alert() {},
    },
    setTimeout(fn, ms) {
      const id = ++sequence;
      timers.set(id, { fn, ms });
      return id;
    },
    clearTimeout(id) { timers.delete(id); },
    SpeechSynthesisUtterance: class { constructor(value) { this.text = value; } },
  });
  vm.runInContext(`
    const TSMC_WORDS = [{ id: 1, word: "ability", meaning: "能力" }];
    const TSMC_STAGES_META = [];
    let tsmcAutoplayRunning = true;
    let tsmcAutoplayPool = TSMC_WORDS;
    let tsmcAutoplayIndex = 0;
    let tsmcAutoplayTimeout = null;
  ` + code, context);
  return {
    start: () => vm.runInContext("runAutoplayStep()", context),
    stop: () => vm.runInContext("stopTsmcAutoplay()", context),
    emit: (type) => activeAudio.emit(type),
    scheduled: (ms) => [...timers.values()].some((timer) => timer.ms === ms),
  };
}

(async () => {
  const normal = setup();
  const pending = normal.start();
  assert.ok(normal.scheduled(8000), "An English-audio safety timeout is expected");
  assert.equal(normal.scheduled(200), false, "Chinese must not start before English finishes");
  normal.emit("pause"); // A delayed pause from a previous audio clip is not a stop.
  await Promise.resolve();
  assert.equal(normal.scheduled(200), false, "Old pause must not finish the current recording");
  normal.emit("ended");
  await pending;
  assert.equal(normal.scheduled(200), true, "Chinese should follow English completion");

  const canceled = setup();
  const canceledRun = canceled.start();
  canceled.stop();
  await canceledRun;
  assert.equal(canceled.scheduled(200), false, "Stopping autoplay must not resume Chinese");

  const errored = setup();
  const errorRun = errored.start();
  errored.emit("error");
  await errorRun;
  assert.equal(errored.scheduled(200), true, "A missing recording must not stall autoplay");

  console.log("PASS: English completion, cancel safety, error recovery");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
