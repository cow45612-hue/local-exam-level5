// TSMC second-pass review: 30 questions per round (kept separate from the original 24 stages).
// Source: the site's original 288-word tsmc-vocabulary.json. No MP3 files are changed.
const TSMC_REVIEW_STORAGE_KEY = "tsmc-review-30-v1";
const TSMC_REVIEW_QUESTION_COUNT = 30;
let tsmcReviewMemory = null;

function tsmcReviewDefaultState() {
  return { seenIds: [], wrongCounts: {}, completedRounds: 0, completedDrills: 0,
    srs: {}, currentRound: null, lastResult: null };
}

function tsmcReviewState() {
  if (tsmcReviewMemory) return tsmcReviewMemory;
  try {
    const saved = JSON.parse(localStorage.getItem(TSMC_REVIEW_STORAGE_KEY));
    if (saved && Array.isArray(saved.seenIds) && saved.wrongCounts && typeof saved.wrongCounts === "object") {
      const srs = saved.srs && typeof saved.srs === "object" && !Array.isArray(saved.srs)
        ? { ...saved.srs } : {};
      // Old wrong answers have no timestamps: make them due today, without inventing a past review.
      let upgraded = false;
      for (const [id, count] of Object.entries(saved.wrongCounts)) {
        if (Number(count) > 0 && !Object.hasOwn(srs, id)) {
          srs[id] = { step: 0, due: tsmcReviewToday(), lastPracticed: "" };
          upgraded = true;
        }
      }
      tsmcReviewMemory = {
        seenIds: [...new Set(saved.seenIds.filter(Number.isInteger))],
        wrongCounts: saved.wrongCounts,
        completedRounds: Math.max(0, Number(saved.completedRounds) || 0),
        completedDrills: Math.max(0, Number(saved.completedDrills) || 0),
        srs,
        currentRound: saved.currentRound || null,
        lastResult: saved.lastResult || null,
      };
      if (upgraded) tsmcReviewSave();
      return tsmcReviewMemory;
    }
  } catch (error) {
    console.warn("無法讀取台積電總複習進度:", error);
  }
  tsmcReviewMemory = tsmcReviewDefaultState();
  return tsmcReviewMemory;
}

function tsmcReviewSave() {
  try {
    localStorage.setItem(TSMC_REVIEW_STORAGE_KEY, JSON.stringify(tsmcReviewState()));
  } catch (error) {
    console.warn("無法儲存台積電總複習進度:", error);
  }
}


function tsmcReviewToday() {
  const date = new Date();
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0")].join("-");
}
function tsmcReviewPlusDays(day, offset) {
  const [year, month, date] = day.split("-").map(Number);
  const next = new Date(year, month - 1, date + offset, 12);
  return [next.getFullYear(), String(next.getMonth() + 1).padStart(2, "0"),
    String(next.getDate()).padStart(2, "0")].join("-");
}
function tsmcReviewDue(record, today = tsmcReviewToday()) {
  return !!record && Number.isInteger(record.step) && record.step < 3
    && typeof record.due === "string" && record.due <= today;
}
function tsmcReviewDueWords(state = tsmcReviewState()) {
  const today = tsmcReviewToday();
  return TSMC_WORDS.filter((word) =>
    Number(state.wrongCounts[word.id]) > 0 && tsmcReviewDue(state.srs[word.id], today));
}
function tsmcReviewRecordAnswer(state, id, correct) {
  const key = String(id), today = tsmcReviewToday();
  const before = state.srs[key];
  if (!correct) {
    state.wrongCounts[key] = (Number(state.wrongCounts[key]) || 0) + 1;
    state.srs[key] = { step: 0, due: tsmcReviewPlusDays(today, 1), lastPracticed: today };
    return;
  }
  if (!before) return;
  const after = { ...before, lastPracticed: today };
  // Early practice is allowed, but cannot advance an interval prematurely.
  if (tsmcReviewDue(before, today)) {
    after.step = before.step + 1;
    after.due = after.step === 1 ? tsmcReviewPlusDays(today, 3)
      : after.step === 2 ? tsmcReviewPlusDays(today, 7) : null;
  }
  state.srs[key] = after;
}

function tsmcReviewReady() {
  return TSMC_WORDS.length === 288
    && TSMC_WORDS.every((word) => Number.isInteger(word.id) && typeof word.meaning === "string")
    && new Set(TSMC_WORDS.map((word) => word.id)).size === 288;
}

function tsmcReviewShuffle(items) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function tsmcReviewChoices(word) {
  // Different IDs alone are insufficient: avoid duplicate visible Chinese meanings.
  const byMeaning = new Map();
  for (const candidate of tsmcReviewShuffle(TSMC_WORDS)) {
    if (candidate.id !== word.id && candidate.meaning !== word.meaning
        && !byMeaning.has(candidate.meaning)) {
      byMeaning.set(candidate.meaning, candidate.id);
    }
    if (byMeaning.size === 3) break;
  }
  if (byMeaning.size !== 3) throw new Error("無法組成 4 個不同中文選項");
  return tsmcReviewShuffle([word.id, ...byMeaning.values()]);
}

function tsmcReviewValidRound(round) {
  if (!round || !Array.isArray(round.questions)) return false;
  const count = round.questions.length;
  if (round.mode === "drill" ? count < 1 || count > TSMC_REVIEW_QUESTION_COUNT
      : count !== TSMC_REVIEW_QUESTION_COUNT) return false;
  const all = new Set(TSMC_WORDS.map((word) => word.id));
  const ids = round.questions.map((question) => question.id);
  return new Set(ids).size === count
    && Array.isArray(round.newIds)
    && round.questions.every((question) => all.has(question.id)
      && Array.isArray(question.choices) && question.choices.length === 4
      && new Set(question.choices).size === 4 && question.choices.includes(question.id)
      && question.choices.every((id) => all.has(id))
      && (question.chosen === null || question.choices.includes(question.chosen)))
    && Number.isInteger(round.position) && round.position >= 0
    && round.position < count;
}

function tsmcReviewNewRound() {
  if (!tsmcReviewReady()) return false;
  const state = tsmcReviewState();
  if (tsmcReviewValidRound(state.currentRound)) return true;

  const seen = new Set(state.seenIds);
  const unseen = tsmcReviewShuffle(TSMC_WORDS.filter((word) => !seen.has(word.id)));
  const first = unseen.slice(0, TSMC_REVIEW_QUESTION_COUNT);
  const needed = TSMC_REVIEW_QUESTION_COUNT - first.length;
  const reviewPool = tsmcReviewShuffle(TSMC_WORDS.filter((word) => seen.has(word.id)));
  // On the 10th round, fill the final 12 slots with old words, prioritizing mistakes.
  reviewPool.sort((left, right) =>
    (Number(state.wrongCounts[right.id]) || 0) - (Number(state.wrongCounts[left.id]) || 0));
  const picked = tsmcReviewShuffle([...first, ...reviewPool.slice(0, needed)]);
  if (picked.length !== TSMC_REVIEW_QUESTION_COUNT) return false;

  state.currentRound = {
    questions: picked.map((word) => ({ id: word.id, choices: tsmcReviewChoices(word), chosen: null })),
    newIds: first.map((word) => word.id),
    position: 0,
  };
  tsmcReviewSave();
  return true;
}


function tsmcReviewNewDrill(scope) {
  if (!tsmcReviewReady() || !["due", "all"].includes(scope)) return false;
  const state = tsmcReviewState();
  if (tsmcReviewValidRound(state.currentRound)) return false;
  const today = tsmcReviewToday();
  const candidates = tsmcReviewShuffle(TSMC_WORDS.filter((word) =>
    Number(state.wrongCounts[word.id]) > 0 &&
    (scope === "all" || tsmcReviewDue(state.srs[word.id], today))));
  candidates.sort((a, b) => {
    const left = state.srs[a.id] || {}, right = state.srs[b.id] || {};
    return Number(tsmcReviewDue(right, today)) - Number(tsmcReviewDue(left, today))
      || (left.lastPracticed || "").localeCompare(right.lastPracticed || "")
      || (Number(state.wrongCounts[b.id]) || 0) - (Number(state.wrongCounts[a.id]) || 0);
  });
  const selected = candidates.slice(0, TSMC_REVIEW_QUESTION_COUNT);
  if (!selected.length) return false;
  state.currentRound = {
    mode: "drill", scope,
    questions: selected.map((word) =>
      ({ id: word.id, choices: tsmcReviewChoices(word), chosen: null })),
    newIds: [], position: 0,
  };
  tsmcReviewSave();
  return true;
}

function tsmcReviewSelect(choiceId) {
  const state = tsmcReviewState(), round = state.currentRound;
  if (!tsmcReviewValidRound(round)) return;
  const question = round.questions[round.position];
  if (!question.choices.includes(choiceId)) return;
  question.chosen = choiceId;
  tsmcReviewSave();
  renderTsmcReview();
}

function tsmcReviewNavigate(delta) {
  const state = tsmcReviewState(), round = state.currentRound;
  if (!tsmcReviewValidRound(round)) return;
  if (delta > 0 && round.questions[round.position].chosen === null) return;
  round.position = Math.max(0, Math.min(round.questions.length - 1, round.position + delta));
  tsmcReviewSave();
  renderTsmcReview();
}

function tsmcReviewSubmit() {
  const state = tsmcReviewState(), round = state.currentRound;
  if (!tsmcReviewValidRound(round) || round.questions.some((q) => q.chosen === null)) return false;
  const sourceIds = new Set(TSMC_WORDS.map((word) => word.id));
  const isDrill = round.mode === "drill";
  const seen = new Set(state.seenIds.filter((id) => sourceIds.has(id)));
  const wrong = [];
  let correct = 0;
  for (const question of round.questions) {
    if (!isDrill) seen.add(question.id);
    const ok = question.chosen === question.id;
    tsmcReviewRecordAnswer(state, question.id, ok);
    if (ok) correct += 1;
    else wrong.push({ id: question.id, chosen: question.chosen });
  }
  state.seenIds = [...seen];
  if (isDrill) state.completedDrills += 1;
  else state.completedRounds += 1;
  state.lastResult = {
    mode: isDrill ? "drill" : "review",
    scope: isDrill ? round.scope : null,
    correct,
    total: round.questions.length,
    newCount: round.newIds.length,
    wrong,
    roundNumber: isDrill ? state.completedDrills : state.completedRounds,
  };
  state.currentRound = null;
  tsmcReviewSave();
  renderTsmcReview();
  return true;
}

function tsmcReviewEl(id) {
  return document.getElementById(id);
}

function tsmcReviewSetText(id, value) {
  const element = tsmcReviewEl(id);
  if (element) element.textContent = value;
}

function tsmcReviewListItem(parent, main, detail) {
  const item = document.createElement("li");
  const strong = document.createElement("strong");
  const small = document.createElement("small");
  strong.textContent = main;
  small.textContent = detail;
  item.append(strong, small);
  parent.appendChild(item);
}

function renderTsmcReview() {
  const ready = tsmcReviewReady();
  const state = tsmcReviewState();
  const availableIds = new Set(TSMC_WORDS.map((word) => word.id));
  const covered = state.seenIds.filter((id) => availableIds.has(id)).length;
  const mistakes = Object.entries(state.wrongCounts).filter(([id, count]) =>
    availableIds.has(Number(id)) && Number(count) > 0).length;

  tsmcReviewSetText("tsmc-review-covered", covered + " / 288");
  tsmcReviewSetText("tsmc-review-rounds", state.completedRounds);
  tsmcReviewSetText("tsmc-review-mistakes", mistakes);
  const dueCount = ready ? tsmcReviewDueWords(state).length : 0;
  tsmcReviewSetText("tsmc-srs-due-count", dueCount);
  const dueButton = tsmcReviewEl("tsmc-srs-due-start");
  const allButton = tsmcReviewEl("tsmc-srs-all-start");
  if (dueButton) {
    dueButton.disabled = !ready || dueCount === 0;
    dueButton.textContent = "今日到期複習（" + dueCount + " 字）";
  }
  if (allButton) {
    allButton.disabled = !ready || mistakes === 0;
    allButton.textContent = "錯題專練（" + mistakes + " 字）";
  }
  const home = tsmcReviewEl("tsmc-review-home");
  const questionBox = tsmcReviewEl("tsmc-review-question");
  const resultBox = tsmcReviewEl("tsmc-review-result");
  const valid = ready && tsmcReviewValidRound(state.currentRound);
  if (home) home.hidden = valid;
  if (questionBox) questionBox.hidden = !valid;
  if (resultBox) resultBox.hidden = valid || !state.lastResult;

  const start = tsmcReviewEl("tsmc-review-start");
  if (start) {
    start.disabled = !ready;
    start.textContent = valid ? "繼續本回合" : "開始第 " + (state.completedRounds + 1) + " 回合・30 題";
  }
  if (!ready) {
    tsmcReviewSetText("tsmc-review-plan", "官方 288 字題庫載入中，請稍候。");
    return;
  }
  const unseenCount = Math.max(0, TSMC_WORDS.length - covered);
  const nextFresh = Math.min(30, unseenCount);
  const nextReview = 30 - nextFresh;
  tsmcReviewSetText("tsmc-review-plan",
    unseenCount ? "下一回合：" + nextFresh + " 題未測單字＋" + nextReview
      + " 題複習；未交卷前不計入覆蓋進度。" : "288 字已全部測過。之後每回合複習 30 題，優先抽選錯題。");

  const wordById = new Map(TSMC_WORDS.map((word) => [word.id, word]));
  if (valid) {
    const round = state.currentRound;
    const question = round.questions[round.position];
    const word = wordById.get(question.id);
    const answered = round.questions.filter((entry) => entry.chosen !== null).length;
    tsmcReviewSetText("tsmc-review-number",
      "第 " + (round.position + 1) + " / " + round.questions.length + " 題");
    tsmcReviewSetText("tsmc-review-answered",
      "已作答 " + answered + " / " + round.questions.length);
    tsmcReviewSetText("tsmc-review-question-type",
      round.mode === "drill" ? (round.scope === "due" ? "今日到期" : "錯題專練")
        : round.newIds.includes(question.id) ? "第一次測驗" : "舊字複習");
    tsmcReviewSetText("tsmc-review-word", word.word);
    const bar = tsmcReviewEl("tsmc-review-bar");
    if (bar) bar.style.width = (answered / round.questions.length * 100) + "%";
    const options = tsmcReviewEl("tsmc-review-choices");
    if (options) {
      options.replaceChildren();
      for (const [i, id] of question.choices.entries()) {
        const choice = wordById.get(id);
        const button = document.createElement("button");
        button.type = "button";
        button.className = "tsmc-review-choice" + (id === question.chosen ? " selected" : "");
        button.setAttribute("aria-pressed", String(id === question.chosen));
        button.textContent = "ABCD"[i] + ". " + choice.meaning;
        button.addEventListener("click", () => tsmcReviewSelect(id));
        options.appendChild(button);
      }
    }
    const previous = tsmcReviewEl("tsmc-review-previous");
    const next = tsmcReviewEl("tsmc-review-next");
    const submit = tsmcReviewEl("tsmc-review-submit");
    if (previous) previous.disabled = round.position === 0;
    if (next) {
      next.hidden = round.position === round.questions.length - 1;
      next.disabled = question.chosen === null;
    }
    if (submit) {
      submit.hidden = round.position !== round.questions.length - 1;
      submit.disabled = answered !== round.questions.length;
    }
  }

  const result = state.lastResult;
  if (result && resultBox && !valid) {
    tsmcReviewSetText("tsmc-review-score",
      (result.mode === "drill" ? "第 " + result.roundNumber + " 次錯題專練"
        : "第 " + result.roundNumber + " 回合總複習")
      + "：" + result.correct + " / " + result.total + " 題");
    tsmcReviewSetText("tsmc-review-result-summary",
      "正確率 " + Math.round(result.correct / result.total * 100) + "%"
      + (result.mode === "drill"
        ? "。按期答對才會完成 1、3、7 天複習；提前練習不會提早過關。"
        : "，本回合涵蓋 " + result.newCount + " 個第一次測驗的單字。"));
    const list = tsmcReviewEl("tsmc-review-result-wrong");
    if (list) {
      list.replaceChildren();
      for (const mistake of result.wrong) {
        const word = wordById.get(mistake.id);
        const chosen = wordById.get(mistake.chosen);
        if (word) tsmcReviewListItem(list, word.word,
          "正確：" + word.meaning + "｜你選：" + (chosen ? chosen.meaning : "未知"));
      }
      if (!result.wrong.length) tsmcReviewListItem(list, "30 題全對", "本回合沒有錯題。");
    }
  }

  const wrongbook = tsmcReviewEl("tsmc-review-wrongbook");
  if (wrongbook) {
    wrongbook.replaceChildren();
    const entries = Object.entries(state.wrongCounts)
      .filter(([id, count]) => wordById.has(Number(id)) && Number(count) > 0)
      .sort((left, right) => Number(right[1]) - Number(left[1]) || Number(left[0]) - Number(right[0]));
    if (!entries.length) tsmcReviewListItem(wrongbook, "目前沒有錯題", "交卷後會自動記錄。");
    for (const [id, count] of entries) {
      const word = wordById.get(Number(id));
      const srs = state.srs[id];
      const schedule = srs?.step >= 3 ? "已完成 1、3、7 天複習"
        : tsmcReviewDue(srs) ? "今天到期"
        : srs?.due ? "下次 " + srs.due : "尚未排程";
      tsmcReviewListItem(wrongbook, word.word,
        word.meaning + "｜累計答錯 " + Number(count) + " 次｜" + schedule);
    }
  }
}

// Buttons belong only to this subview; the original quizzes and their progress are untouched.
const tsmcReviewStartButton = document.getElementById("tsmc-review-start");
if (tsmcReviewStartButton) {
  tsmcReviewStartButton.addEventListener("click", () => {
    if (tsmcReviewNewRound()) renderTsmcReview();
  });
}
const tsmcReviewPreviousButton = document.getElementById("tsmc-review-previous");
if (tsmcReviewPreviousButton) tsmcReviewPreviousButton.addEventListener("click", () => tsmcReviewNavigate(-1));
const tsmcReviewNextButton = document.getElementById("tsmc-review-next");
if (tsmcReviewNextButton) tsmcReviewNextButton.addEventListener("click", () => tsmcReviewNavigate(1));
const tsmcReviewSubmitButton = document.getElementById("tsmc-review-submit");
if (tsmcReviewSubmitButton) tsmcReviewSubmitButton.addEventListener("click", tsmcReviewSubmit);
const tsmcReviewAudioButton = document.getElementById("tsmc-review-audio");
if (tsmcReviewAudioButton) {
  tsmcReviewAudioButton.addEventListener("click", () => {
    const round = tsmcReviewState().currentRound;
    if (!tsmcReviewValidRound(round)) return;
    const word = TSMC_WORDS.find((item) => item.id === round.questions[round.position].id);
    if (word) playTsmcAudio(word, false);
  });
}

const tsmcSrsDueButton = document.getElementById("tsmc-srs-due-start");
if (tsmcSrsDueButton) tsmcSrsDueButton.addEventListener("click", () => {
  if (tsmcReviewNewDrill("due")) renderTsmcReview();
});
const tsmcSrsAllButton = document.getElementById("tsmc-srs-all-start");
if (tsmcSrsAllButton) tsmcSrsAllButton.addEventListener("click", () => {
  if (tsmcReviewNewDrill("all")) renderTsmcReview();
});
