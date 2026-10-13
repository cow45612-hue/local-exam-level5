// Run with: node scripts/test_tsmc_review.cjs
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.join(__dirname, "..");
const vocabulary = JSON.parse(fs.readFileSync(path.join(root, "tsmc-vocabulary.json"), "utf8"));
const code = fs.readFileSync(path.join(root, "tsmc-review.js"), "utf8");
assert.equal(vocabulary.length, 288);
assert.equal(new Set(vocabulary.map((word) => word.id)).size, 288);
const backing = new Map([["tsmc_stage_progress_v2", "DO_NOT_TOUCH"]]);
const store = {
  getItem(key) { return backing.get(key) || null; },
  setItem(key, value) { backing.set(key, value); },
};
function boot() {
  const context = vm.createContext({
    TSMC_WORDS: vocabulary,
    localStorage: store,
    document: { getElementById() { return null; } },
    console,
  });
  vm.runInContext(code, context);
  return {
    exec(cmd) { return vm.runInContext(cmd, context); },
    getState() { return JSON.parse(backing.get("tsmc-review-30-v1") || "null"); },
  };
}
let app = boot();
const firstNineIds = new Set();
for (let roundIndex = 1; roundIndex <= 10; roundIndex += 1) {
  assert.equal(app.exec("tsmcReviewNewRound()"), true);
  let state = app.getState();
  let round = state.currentRound;
  assert.equal(round.questions.length, 30);
  assert.equal(new Set(round.questions.map((question) => question.id)).size, 30);
  const expectedNew = roundIndex <= 9 ? 30 : 18;
  assert.equal(round.newIds.length, expectedNew);
  for (const question of round.questions) {
    assert.equal(question.choices.length, 4);
    assert.equal(new Set(question.choices).size, 4);
    assert.ok(question.choices.includes(question.id));
    const meanings = question.choices.map((id) => vocabulary.find((word) => word.id === id).meaning);
    assert.equal(new Set(meanings).size, 4, "Chinese options must be unambiguous");
    if (roundIndex <= 9) {
      assert.equal(firstNineIds.has(question.id), false, "Words cannot repeat before coverage");
      firstNineIds.add(question.id);
    }
  }
  if (roundIndex === 1) {
    // Navigating forwards requires answering each earlier question.
    for (let step = 0; step < 5; step += 1) {
      app.exec("tsmcReviewSelect(" + round.questions[step].id + ")");
      app.exec("tsmcReviewNavigate(1)");
    }
    app = boot();
    assert.equal(app.getState().currentRound.position, 5, "A refresh must preserve position");
    app.exec("tsmcReviewNavigate(-5)");
  }
  // A user can submit only after answering every question. In the first round,
  // intentionally mark 12 wrong so the tenth round prioritizes those old words.
  assert.equal(app.exec("tsmcReviewSubmit()"), false);
  for (let i = 0; i < round.questions.length; i += 1) {
    let pick = round.questions[i].id;
    if (roundIndex === 1 && i < 12) pick = round.questions[i].choices.find((id) => id !== pick);
    app.exec("tsmcReviewNavigate(" + (i === 0 ? 0 : 1) + ")");
    app.exec("tsmcReviewSelect(" + pick + ")");
  }
  assert.equal(app.exec("tsmcReviewSubmit()"), true);
  state = app.getState();
  assert.equal(state.currentRound, null);
  assert.equal(state.completedRounds, roundIndex);
  assert.equal(state.seenIds.length, Math.min(roundIndex * 30, 288));
  assert.equal(state.lastResult.newCount, expectedNew);
  if (roundIndex === 1) {
    assert.equal(state.lastResult.correct, 18);
    assert.equal(Object.keys(state.wrongCounts).length, 12);
  }
  if (roundIndex === 10) {
    const reviewed = round.questions.filter((q) => !round.newIds.includes(q.id));
    assert.equal(reviewed.length, 12);
    assert.ok(reviewed.every((q) => Number(state.wrongCounts[q.id]) >= 1),
      "Tenth-round fill-ins should prioritize the twelve incorrect words");
  }
  if (roundIndex < 10) app = boot();
}
app = boot();
assert.equal(app.getState().seenIds.length, 288);
assert.equal(app.exec("tsmcReviewNewRound()"), true);
const extra = app.getState().currentRound;
assert.equal(extra.questions.length, 30);
assert.equal(extra.newIds.length, 0);
assert.equal(backing.get("tsmc_stage_progress_v2"), "DO_NOT_TOUCH");
assert.equal(backing.has("initial-exam-wrong-question-ids"), false);
console.log("PASS: 288 unique first-pass coverage in ten rounds; 18+12 final round; error-free distractors; persistence; wrong answers; stage progress preserved.");
