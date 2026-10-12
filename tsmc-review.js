// TSMC second-pass review: 30 questions per round (kept separate from the original 24 stages).
// Source: the site's original 288-word tsmc-vocabulary.json. No MP3 files are changed.
const TSMC_REVIEW_STORAGE_KEY = "tsmc-review-30-v1";
const TSMC_REVIEW_QUESTION_COUNT = 30;
let tsmcReviewMemory = null;

function tsmcReviewDefaultState() {
  return { seenIds: [], wrongCounts: {}, completedRounds: 0, currentRound: null, lastResult: null };
}

function tsmcReviewState() {
  if (tsmcReviewMemory) return tsmcReviewMemory;
  try {
    const saved = JSON.parse(localStorage.getItem(TSMC_REVIEW_STORAGE_KEY));
    if (saved && Array.isArray(saved.seenIds) && saved.wrongCounts && typeof saved.wrongCounts === "object") {
      tsmcReviewMemory = {
        seenIds: [...new Set(saved.seenIds.filter(Number.isInteger))],
        wrongCounts: saved.wrongCounts,
        completedRounds: Math.max(0, Number(saved.completedRounds) || 0),
        currentRound: saved.currentRound || null,
        lastResult: saved.lastResult || null,
      };
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
  if (!round || !Array.isArray(round.questions) || round.questions.length !== TSMC_REVIEW_QUESTION_COUNT) return false;
  const all = new Set(TSMC_WORDS.map((word) => word.id));
  const ids = round.questions.map((question) => question.id);
  return new Set(ids).size === TSMC_REVIEW_QUESTION_COUNT
    && round.questions.every((question) => all.has(question.id)
      && Array.isArray(question.choices) && question.choices.length === 4
      && new Set(question.choices).size === 4 && question.choices.includes(question.id)
      && question.choices.every((id) => all.has(id))
      && (question.chosen === null || question.choices.includes(question.chosen)))
    && Number.isInteger(round.position) && round.position >= 0
    && round.position < TSMC_REVIEW_QUESTION_COUNT;
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
  round.position = Math.max(0, Math.min(TSMC_REVIEW_QUESTION_COUNT - 1, round.position + delta));
  tsmcReviewSave();
  renderTsmcReview();
}

function tsmcReviewSubmit() {
  const state = tsmcReviewState(), round = state.currentRound;
  if (!tsmcReviewValidRound(round) || round.questions.some((q) => q.chosen === null)) return false;
  const sourceIds = new Set(TSMC_WORDS.map((word) => word.id));
  const seen = new Set(state.seenIds.filter((id) => sourceIds.has(id)));
  const wrong = [];
  let correct = 0;
  for (const question of round.questions) {
    seen.add(question.id);
    if (question.chosen === question.id) {
      correct += 1;
    } else {
      state.wrongCounts[question.id] = (Number(state.wrongCounts[question.id]) || 0) + 1;
      wrong.push({ id: question.id, chosen: question.chosen });
    }
  }
  state.seenIds = [...seen];
  state.completedRounds += 1;
  state.lastResult = {
    correct,
    total: round.questions.length,
    newCount: round.newIds.length,
    wrong,
    roundNumber: state.completedRounds,
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
    tsmcReviewSetText("tsmc-review-number", "第 " + (round.position + 1) + " / 30 題");
    tsmcReviewSetText("tsmc-review-answered", "已作答 " + answered + " / 30");
    tsmcReviewSetText("tsmc-review-question-type",
      round.newIds.includes(question.id) ? "第一次測驗" : "舊字複習");
    tsmcReviewSetText("tsmc-review-word", word.word);
    const bar = tsmcReviewEl("tsmc-review-bar");
    if (bar) bar.style.width = (answered / 30 * 100) + "%";
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
      next.hidden = round.position === 29;
      next.disabled = question.chosen === null;
    }
    if (submit) {
      submit.hidden = round.position !== 29;
      submit.disabled = answered !== 30;
    }
  }

  const result = state.lastResult;
  if (result && resultBox && !valid) {
    tsmcReviewSetText("tsmc-review-score",
      "第 " + result.roundNumber + " 回合：" + result.correct + " / " + result.total + " 題");
    tsmcReviewSetText("tsmc-review-result-summary",
      "正確率 " + Math.round(result.correct / result.total * 100)
      + "%，本回合涵蓋 " + result.newCount + " 個第一次測驗的單字。");
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
      tsmcReviewListItem(wrongbook, word.word, word.meaning + "｜累計答錯 " + Number(count) + " 次");
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
