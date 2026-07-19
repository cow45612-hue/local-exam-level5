const QUESTION_COUNT = 20;
const TSMC_QUIZ_COUNT = 10;
const WRONG_KEY = "initial-exam-wrong-question-ids";
const DAILY_KEY = "initial-exam-daily-progress";
const SUBJECT_STATS_KEY = "initial-exam-subject-stats";
const QUESTION_STATS_KEY = "initial-exam-question-stats";
const TSMC_PROGRESS_KEY = "tsmc-vocabulary-progress-v1";
const ALL_SUBJECTS = "__all__";

let TSMC_WORDS = [
  { word: "ability", type: "noun", meaning: "能力" },
  { word: "abnormal", type: "adjective", meaning: "異常的" },
  { word: "abort", type: "verb", meaning: "中止" },
  { word: "absence", type: "noun", meaning: "缺席" },
  { word: "acid", type: "noun", meaning: "酸" },
  { word: "active", type: "adjective", meaning: "主動的" },
  { word: "actual", type: "adjective", meaning: "真實的" },
  { word: "adjust", type: "verb", meaning: "調整" },
  { word: "air shower", type: "noun", meaning: "潔淨通道" },
  { word: "alarm", type: "noun", meaning: "警報" },
  { word: "align", type: "verb", meaning: "對焦" },
  { word: "attach", type: "verb", meaning: "附上" },
  { word: "audit", type: "verb", meaning: "稽核、查核" },
  { word: "automatic", type: "adjective", meaning: "自動的" },
  { word: "available", type: "adjective", meaning: "可使用的" },
  { word: "benchmark", type: "noun", meaning: "標竿學習" },
];

const TSMC_MATH_QUESTIONS = [
  { prompt: "一批 480 片晶圓，已完成 75%，尚有多少片未完成？", answer: "480 × (1 - 75%) = 120\n答案：120 片" },
  { prompt: "日班 7:20 開始，工作 12 小時，幾點下班？", answer: "7:20 + 12 小時 = 19:20\n答案：晚上 7:20" },
  { prompt: "機台每小時處理 36 片，連續運作 7.5 小時，共處理多少片？", answer: "36 × 7.5 = 270\n答案：270 片" },
  { prompt: "甲地到乙地 180 公里，平均時速 60 公里，需要多久？", answer: "180 ÷ 60 = 3\n答案：3 小時" },
  { prompt: "原本不良品 25 件，改善後減少 40%，還剩多少件？", answer: "25 × (1 - 40%) = 15\n答案：15 件" },
  { prompt: "夜班 19:20 上班，工作 12 小時，隔天幾點下班？", answer: "19:20 + 12 小時 = 隔日 7:20\n答案：隔天早上 7:20" },
  { prompt: "一箱有 24 盒，15 箱共有多少盒？", answer: "24 × 15 = 360\n答案：360 盒" },
  { prompt: "產量由 800 提升到 920，增加百分之多少？", answer: "(920 - 800) ÷ 800 × 100% = 15%\n答案：增加 15%" },
];

const TSMC_INTERVIEW_QUESTIONS = [
  { prompt: "請用一分鐘介紹自己。", answer: "回答重點：目前背景 → 相關經驗 → 穩定、細心、守規範等工作特質 → 為何適合技術員。" },
  { prompt: "為什麼想應徵台積電技術員？", answer: "回答重點：認同製造與品質文化、希望長期穩定發展，並具體連結自己的輪班適應力、責任感與操作經驗。" },
  { prompt: "你可以接受四班二輪與夜班嗎？", answer: "回答重點：直接表態能否接受，再說明睡眠、交通、飲食與家庭安排。不要只回答『可以』。" },
  { prompt: "工作中發現機台或產品異常，你會怎麼做？", answer: "回答重點：立即依規定停下或隔離 → 通報主管 → 記錄現象 → 不擅自處理 → 配合追查與交接。" },
  { prompt: "請說一個你遇過的挫折，以及如何解決。", answer: "回答重點：用 STAR 結構回答：情境、任務、採取行動、最後結果與學到什麼。" },
  { prompt: "如果同事為了趕產量，想省略一個步驟，你會怎麼做？", answer: "回答重點：品質與安全優先，先提醒同事依 SOP；若仍未改善，依層級通報，不用人情掩蓋風險。" },
  { prompt: "重複性高的工作，你如何維持專注？", answer: "回答重點：依檢查表、固定節奏、自我覆核與交接紀錄降低疏失，並舉過去實際例子。" },
  { prompt: "主管臨時要求加班，你會如何回應？", answer: "回答重點：先確認工作需求與自身狀況；能配合就明確回覆，不能配合則提早誠實說明，不臨時失聯。" },
];

const state = {
  allQuestions: [],
  currentQuestions: [],
  answers: [],
  results: [],
  currentIndex: 0,
  mode: "random",
  previousView: "start",
};

const els = {
  views: {
    home: document.querySelector("#home-view"),
    start: document.querySelector("#start-view"),
    wrongbook: document.querySelector("#wrongbook-view"),
    stats: document.querySelector("#stats-view"),
    quiz: document.querySelector("#quiz-view"),
    result: document.querySelector("#result-view"),
  },
  navItems: document.querySelectorAll(".nav-item"),
  subjectSelect: document.querySelector("#subject-select"),
  startRandom: document.querySelector("#start-random"),
  startWrong: document.querySelector("#start-wrong"),
  homeStartRandom: document.querySelector("#home-start-random"),
  homeStartWrong: document.querySelector("#home-start-wrong"),
  wrongbookStart: document.querySelector("#wrongbook-start"),
  topTodayStatus: document.querySelector("#top-today-status"),
  heroStreak: document.querySelector("#hero-streak"),
  heroTotalCount: document.querySelector("#hero-total-count"),
  heroTodayStatus: document.querySelector("#hero-today-status"),
  homeWrongCount: document.querySelector("#home-wrong-count"),
  streakCount: document.querySelector("#streak-count"),
  dailySummary: document.querySelector("#daily-summary"),
  wrongCount: document.querySelector("#wrong-count"),
  loadMessage: document.querySelector("#load-message"),
  wrongbookList: document.querySelector("#wrongbook-list"),
  subjectStatsList: document.querySelector("#subject-stats-list"),
  statsSummary: document.querySelector("#stats-summary"),
  quizTitle: document.querySelector("#quiz-title"),
  progressText: document.querySelector("#progress-text"),
  progressFill: document.querySelector("#progress-fill"),
  backHome: document.querySelector("#back-home"),
  questionNumber: document.querySelector("#question-number"),
  questionYear: document.querySelector("#question-year"),
  subjectBadge: document.querySelector("#subject-badge"),
  questionText: document.querySelector("#question-text"),
  options: document.querySelector("#options"),
  feedbackCard: document.querySelector("#feedback-card"),
  feedbackTitle: document.querySelector("#feedback-title"),
  feedbackAnswer: document.querySelector("#feedback-answer"),
  feedbackExplanation: document.querySelector("#feedback-explanation"),
  continueQuiz: document.querySelector("#continue-quiz"),
  scoreRate: document.querySelector("#score-rate"),
  scoreDetail: document.querySelector("#score-detail"),
  resultWrongCount: document.querySelector("#result-wrong-count"),
  resultRateSmall: document.querySelector("#result-rate-small"),
  resultEncouragement: document.querySelector("#result-encouragement"),
  retrySame: document.querySelector("#retry-same"),
  resultHome: document.querySelector("#result-home"),
  reviewList: document.querySelector("#review-list"),
  tsmcWord: document.querySelector("#tsmc-word"),
  tsmcWordType: document.querySelector("#tsmc-word-type"),
  tsmcWordAnswer: document.querySelector("#tsmc-word-answer"),
  tsmcWordProgress: document.querySelector("#tsmc-word-progress"),
  tsmcSpeak: document.querySelector("#tsmc-speak"),
  tsmcReveal: document.querySelector("#tsmc-reveal"),
  tsmcNext: document.querySelector("#tsmc-next"),
  tsmcWordCard: document.querySelector("#tsmc-word-card"),
  tsmcPracticeNote: document.querySelector("#tsmc-practice-note"),
  tsmcModeButtons: document.querySelectorAll(".tsmc-mode-button"),
  tsmcStudyTools: document.querySelector("#tsmc-study-tools"),
  tsmcStudySummary: document.querySelector("#tsmc-study-summary"),
  tsmcFilterButtons: document.querySelectorAll(".tsmc-filter-button"),
  tsmcCurrentStatus: document.querySelector("#tsmc-current-status"),
  tsmcMemoryActions: document.querySelector("#tsmc-memory-actions"),
  tsmcMarkReview: document.querySelector("#tsmc-mark-review"),
  tsmcMarkKnown: document.querySelector("#tsmc-mark-known"),
  tsmcWordActions: document.querySelector("#tsmc-word-actions"),
  tsmcQuizCard: document.querySelector("#tsmc-quiz-card"),
  tsmcQuizProgress: document.querySelector("#tsmc-quiz-progress"),
  tsmcQuizScore: document.querySelector("#tsmc-quiz-score"),
  tsmcQuizProgressFill: document.querySelector("#tsmc-quiz-progress-fill"),
  tsmcQuizQuestion: document.querySelector("#tsmc-quiz-question"),
  tsmcQuizChoices: document.querySelector("#tsmc-quiz-choices"),
  tsmcQuizFeedback: document.querySelector("#tsmc-quiz-feedback"),
  tsmcQuizNext: document.querySelector("#tsmc-quiz-next"),
};

const tsmcPracticeIndices = { words: 0, math: 0, interview: 0 };
let tsmcPracticeMode = "words";
let tsmcWordFilter = "all";
let tsmcWordProgress = loadTsmcWordProgress();
let tsmcQuizState = { questions: [], index: 0, score: 0, answered: false, finished: false };

function loadTsmcWordProgress() {
  try {
    return JSON.parse(localStorage.getItem(TSMC_PROGRESS_KEY)) || {};
  } catch {
    return {};
  }
}

function tsmcWordKey(item) {
  return item.word.toLowerCase();
}

function saveTsmcWordProgress() {
  localStorage.setItem(TSMC_PROGRESS_KEY, JSON.stringify(tsmcWordProgress));
}

async function loadTsmcVocabulary() {
  try {
    const response = await fetch("./tsmc-vocabulary.json", { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const vocabulary = await response.json();
    if (!Array.isArray(vocabulary) || vocabulary.length !== 288) {
      throw new Error(`Expected 288 words, found ${vocabulary?.length ?? 0}`);
    }

    TSMC_WORDS = vocabulary;
    tsmcPracticeIndices.words = 0;
    if (tsmcPracticeMode === "wordQuiz") startTsmcQuiz();
    else if (tsmcPracticeMode === "words") renderTsmcWord();
  } catch (error) {
    console.warn("Unable to load the complete TSMC vocabulary; using the built-in fallback.", error);
  }
}

function currentTsmcItems() {
  if (tsmcPracticeMode === "math") return TSMC_MATH_QUESTIONS;
  if (tsmcPracticeMode === "interview") return TSMC_INTERVIEW_QUESTIONS;
  if (tsmcWordFilter === "review") {
    return TSMC_WORDS.filter((item) => tsmcWordProgress[tsmcWordKey(item)] === "review");
  }
  return TSMC_WORDS;
}

function renderTsmcStudySummary() {
  const knownCount = TSMC_WORDS.filter((item) => tsmcWordProgress[tsmcWordKey(item)] === "known").length;
  const reviewCount = TSMC_WORDS.filter((item) => tsmcWordProgress[tsmcWordKey(item)] === "review").length;
  els.tsmcStudySummary.textContent = `已記住 ${knownCount} 個 · 待複習 ${reviewCount} 個`;
  els.tsmcFilterButtons.forEach((button) => {
    const isReview = button.dataset.tsmcFilter === "review";
    button.textContent = isReview ? `只背待複習 ${reviewCount}` : `全部 ${TSMC_WORDS.length}`;
    button.classList.toggle("active", button.dataset.tsmcFilter === tsmcWordFilter);
  });
}

function syncTsmcModeButtons() {
  els.tsmcModeButtons.forEach((button) => button.classList.toggle("active", button.dataset.tsmcMode === tsmcPracticeMode));
}

function renderTsmcWord() {
  const items = currentTsmcItems();
  const isWordMode = tsmcPracticeMode === "words";
  if (isWordMode) renderTsmcStudySummary();
  els.tsmcStudyTools.hidden = !isWordMode;
  els.tsmcMemoryActions.hidden = !isWordMode;
  els.tsmcCurrentStatus.hidden = !isWordMode;
  els.tsmcWordCard.hidden = false;
  els.tsmcWordActions.hidden = false;
  els.tsmcQuizCard.hidden = true;

  if (isWordMode && items.length === 0) {
    els.tsmcWord.textContent = "目前沒有待複習單字";
    els.tsmcWordType.textContent = "完成";
    els.tsmcWordAnswer.textContent = "切回「全部」後，可以繼續標記不熟的單字。";
    els.tsmcWordAnswer.hidden = false;
    els.tsmcCurrentStatus.textContent = "待複習清單是空的";
    els.tsmcWordProgress.textContent = "0 / 0";
    els.tsmcSpeak.disabled = true;
    els.tsmcReveal.disabled = true;
    els.tsmcNext.disabled = true;
    els.tsmcMarkReview.disabled = true;
    els.tsmcMarkKnown.disabled = true;
    els.tsmcWordCard.dataset.studyStatus = "empty";
    return;
  }

  tsmcPracticeIndices[tsmcPracticeMode] %= items.length;
  const index = tsmcPracticeIndices[tsmcPracticeMode];
  const item = items[index];
  els.tsmcWord.textContent = isWordMode ? item.word : item.prompt;
  els.tsmcWordType.textContent = isWordMode ? item.type : tsmcPracticeMode === "math" ? "數學模擬" : "面試題";
  els.tsmcWordAnswer.textContent = isWordMode ? item.meaning : item.answer;
  els.tsmcWordAnswer.hidden = true;
  els.tsmcReveal.textContent = "顯示答案";
  els.tsmcWordProgress.textContent = `${index + 1} / ${items.length}`;
  els.tsmcSpeak.hidden = !isWordMode;
  els.tsmcSpeak.disabled = false;
  els.tsmcReveal.disabled = false;
  els.tsmcNext.disabled = false;
  els.tsmcMarkReview.disabled = false;
  els.tsmcMarkKnown.disabled = false;
  els.tsmcWordCard.classList.toggle("compact", !isWordMode);
  els.tsmcWordCard.dataset.mode = tsmcPracticeMode;
  const studyStatus = isWordMode ? tsmcWordProgress[tsmcWordKey(item)] || "unseen" : "";
  els.tsmcWordCard.dataset.studyStatus = studyStatus;
  els.tsmcCurrentStatus.textContent = studyStatus === "known" ? "已記住" : studyStatus === "review" ? "要繼續背" : "尚未標記";
  els.tsmcPracticeNote.textContent = isWordMode
    ? "單字取自台積電官方參考資料。"
    : tsmcPracticeMode === "math"
      ? "依常見題型自編的模擬題，並非台積電官方或外流考題。"
      : "回答重點供你練習組織內容，請換成自己的真實經驗。";
  syncTsmcModeButtons();
}

function buildTsmcQuizQuestion(word) {
  const choices = [word.meaning];
  for (const candidate of shuffle(TSMC_WORDS)) {
    if (candidate.word === word.word || choices.includes(candidate.meaning)) continue;
    choices.push(candidate.meaning);
    if (choices.length === 4) break;
  }
  return { word, choices: shuffle(choices) };
}

function startTsmcQuiz() {
  const selected = shuffle(TSMC_WORDS).slice(0, Math.min(TSMC_QUIZ_COUNT, TSMC_WORDS.length));
  tsmcQuizState = {
    questions: selected.map(buildTsmcQuizQuestion),
    index: 0,
    score: 0,
    answered: false,
    finished: false,
  };
  renderTsmcQuiz();
}

function renderTsmcQuiz() {
  syncTsmcModeButtons();
  els.tsmcStudyTools.hidden = true;
  els.tsmcMemoryActions.hidden = true;
  els.tsmcCurrentStatus.hidden = true;
  els.tsmcWordCard.hidden = true;
  els.tsmcWordActions.hidden = true;
  els.tsmcQuizCard.hidden = false;
  els.tsmcPracticeNote.textContent = "每回隨機 10 題；答錯的單字會自動加入待複習。";

  if (tsmcQuizState.finished) {
    const total = tsmcQuizState.questions.length;
    const wrongCount = total - tsmcQuizState.score;
    const rate = total ? Math.round((tsmcQuizState.score / total) * 100) : 0;
    els.tsmcWordProgress.textContent = "測驗完成";
    els.tsmcQuizProgress.textContent = "本回成績";
    els.tsmcQuizScore.textContent = `答對 ${tsmcQuizState.score} 題`;
    els.tsmcQuizProgressFill.style.width = "100%";
    els.tsmcQuizQuestion.textContent = `${tsmcQuizState.score} / ${total}`;
    els.tsmcQuizChoices.replaceChildren();
    els.tsmcQuizFeedback.textContent = `答對率 ${rate}% · ${wrongCount} 個錯字已加入待複習`;
    els.tsmcQuizFeedback.className = `tsmc-quiz-feedback ${wrongCount ? "wrong" : "correct"}`;
    els.tsmcQuizFeedback.hidden = false;
    els.tsmcQuizNext.textContent = "再測 10 題";
    els.tsmcQuizNext.hidden = false;
    return;
  }

  const current = tsmcQuizState.questions[tsmcQuizState.index];
  const total = tsmcQuizState.questions.length;
  els.tsmcWordProgress.textContent = `測驗 ${tsmcQuizState.index + 1} / ${total}`;
  els.tsmcQuizProgress.textContent = `第 ${tsmcQuizState.index + 1} / ${total} 題`;
  els.tsmcQuizScore.textContent = `答對 ${tsmcQuizState.score} 題`;
  els.tsmcQuizProgressFill.style.width = `${((tsmcQuizState.index + 1) / total) * 100}%`;
  els.tsmcQuizQuestion.textContent = current.word.word;
  els.tsmcQuizFeedback.hidden = true;
  els.tsmcQuizFeedback.className = "tsmc-quiz-feedback";
  els.tsmcQuizNext.hidden = true;
  els.tsmcQuizNext.textContent = tsmcQuizState.index === total - 1 ? "看成績" : "下一題";
  els.tsmcQuizChoices.replaceChildren();

  current.choices.forEach((choice, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "tsmc-quiz-choice";
    button.dataset.choice = choice;
    button.textContent = `${String.fromCharCode(65 + index)}. ${choice}`;
    button.addEventListener("click", () => answerTsmcQuiz(choice, button));
    els.tsmcQuizChoices.append(button);
  });
}

function answerTsmcQuiz(choice, selectedButton) {
  if (tsmcQuizState.answered) return;
  tsmcQuizState.answered = true;
  const current = tsmcQuizState.questions[tsmcQuizState.index];
  const isCorrect = choice === current.word.meaning;

  if (isCorrect) {
    tsmcQuizState.score += 1;
  } else {
    tsmcWordProgress[tsmcWordKey(current.word)] = "review";
    saveTsmcWordProgress();
  }

  [...els.tsmcQuizChoices.children].forEach((button) => {
    button.disabled = true;
    if (button.dataset.choice === current.word.meaning) button.classList.add("correct");
  });
  if (!isCorrect) selectedButton.classList.add("wrong");

  els.tsmcQuizScore.textContent = `答對 ${tsmcQuizState.score} 題`;
  els.tsmcQuizFeedback.textContent = isCorrect
    ? `答對了！${current.word.word} 是「${current.word.meaning}」`
    : `答錯了，正確答案是「${current.word.meaning}」`;
  els.tsmcQuizFeedback.className = `tsmc-quiz-feedback ${isCorrect ? "correct" : "wrong"}`;
  els.tsmcQuizFeedback.hidden = false;
  els.tsmcQuizNext.hidden = false;
}

els.tsmcQuizNext.addEventListener("click", () => {
  if (tsmcQuizState.finished) {
    startTsmcQuiz();
    return;
  }
  if (!tsmcQuizState.answered) return;
  if (tsmcQuizState.index === tsmcQuizState.questions.length - 1) {
    tsmcQuizState.finished = true;
  } else {
    tsmcQuizState.index += 1;
    tsmcQuizState.answered = false;
  }
  renderTsmcQuiz();
});

els.tsmcReveal.addEventListener("click", () => {
  const willShow = els.tsmcWordAnswer.hidden;
  els.tsmcWordAnswer.hidden = !willShow;
  els.tsmcReveal.textContent = willShow ? "隱藏答案" : "顯示答案";
});

els.tsmcNext.addEventListener("click", () => {
  const items = currentTsmcItems();
  tsmcPracticeIndices[tsmcPracticeMode] = (tsmcPracticeIndices[tsmcPracticeMode] + 1) % items.length;
  renderTsmcWord();
});

function markCurrentTsmcWord(status) {
  const items = currentTsmcItems();
  const item = items[tsmcPracticeIndices.words];
  if (!item) return;

  tsmcWordProgress[tsmcWordKey(item)] = status;
  saveTsmcWordProgress();
  if (tsmcWordFilter === "all") tsmcPracticeIndices.words = (tsmcPracticeIndices.words + 1) % items.length;
  if (tsmcWordFilter === "review" && status === "review") {
    tsmcPracticeIndices.words = (tsmcPracticeIndices.words + 1) % items.length;
  }
  renderTsmcWord();
}

els.tsmcMarkReview.addEventListener("click", () => markCurrentTsmcWord("review"));
els.tsmcMarkKnown.addEventListener("click", () => markCurrentTsmcWord("known"));

els.tsmcFilterButtons.forEach((button) => {
  button.addEventListener("click", () => {
    tsmcWordFilter = button.dataset.tsmcFilter;
    tsmcPracticeIndices.words = 0;
    renderTsmcWord();
  });
});

els.tsmcSpeak.addEventListener("click", () => {
  if (!("speechSynthesis" in window)) return;
  const item = currentTsmcItems()[tsmcPracticeIndices.words];
  if (!item) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(item.word);
  utterance.lang = "en-US";
  utterance.rate = 0.85;
  window.speechSynthesis.speak(utterance);
});

els.tsmcModeButtons.forEach((button) => {
  button.addEventListener("click", () => {
    tsmcPracticeMode = button.dataset.tsmcMode;
    if (tsmcPracticeMode === "wordQuiz") {
      if (tsmcQuizState.questions.length && !tsmcQuizState.finished) renderTsmcQuiz();
      else startTsmcQuiz();
    } else {
      renderTsmcWord();
    }
  });
});

renderTsmcWord();
loadTsmcVocabulary();

function normalizeQuestion(raw, index) {
  const teacher = raw.teacherExplanation ?? {};
  const hasTeacherExplanation = Boolean(raw.teacherExplanation || raw.explanationQuality === "ai_generated" || raw.correctReason);
  return {
    id: String(raw.id ?? index + 1),
    year: raw.year ?? "",
    exam: raw.exam ?? "初等考試",
    category: raw.category ?? "",
    subject: raw.subject,
    question: raw.question,
    options: {
      A: raw.options?.A ?? raw.A,
      B: raw.options?.B ?? raw.B,
      C: raw.options?.C ?? raw.C,
      D: raw.options?.D ?? raw.D,
    },
    answer: String(raw.answer ?? "").toUpperCase(),
    explanation: raw.explanation,
    trap: raw.trap ?? "",
    concept: raw.concept ?? teacher.concept ?? "",
    keyPoint: raw.keyPoint ?? teacher.keyPoint ?? "",
    topic: raw.topic ?? teacher.topic ?? "",
    subTopic: raw.subTopic ?? teacher.subTopic ?? "",
    frequency: raw.frequency ?? teacher.frequency ?? "",
    thinkingSteps: raw.thinkingSteps ?? teacher.thinkingSteps ?? [],
    plainExplanation: raw.plainExplanation ?? raw.correctReason ?? teacher.correctReason ?? "",
    correctReason: raw.correctReason ?? teacher.correctReason ?? "",
    optionAnalysis: raw.optionAnalysis ?? teacher.optionAnalysis ?? {},
    memoryTip: raw.memoryTip ?? teacher.memoryTip ?? "",
    keywords: raw.keywords ?? teacher.keywords ?? "",
    hasTeacherExplanation,
  };
}

async function loadQuestions() {
  const response = await fetch("./questions.json", { cache: "no-store" });
  if (!response.ok) {
    throw new Error("題庫載入失敗，請確認 questions.json 存在。");
  }

  const data = await response.json();
  return data.map(normalizeQuestion).filter((item) => {
    return item.subject && item.question && item.options.A && item.options.B && item.options.C && item.options.D && item.answer && item.explanation;
  });
}

function readStorage(key, fallback) {
  try {
    const value = JSON.parse(localStorage.getItem(key));
    return value ?? fallback;
  } catch {
    return fallback;
  }
}

function writeStorage(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function todayKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function dateBefore(dateText) {
  const date = new Date(`${dateText}T00:00:00`);
  date.setDate(date.getDate() - 1);
  return todayKey(date);
}

function getWrongIds() {
  return readStorage(WRONG_KEY, []);
}

function setWrongIds(ids) {
  writeStorage(WRONG_KEY, [...new Set(ids)]);
  updateDashboard();
}

function getDailyProgress() {
  const saved = readStorage(DAILY_KEY, {});
  return {
    completedDates: Array.isArray(saved.completedDates) ? saved.completedDates : [],
    streak: Number(saved.streak) || 0,
    totalCompletedDays: Number(saved.totalCompletedDays) || 0,
    lastCompletedDate: saved.lastCompletedDate || "",
  };
}

function setDailyProgress(progress) {
  writeStorage(DAILY_KEY, progress);
}

function getSubjectStats() {
  return readStorage(SUBJECT_STATS_KEY, {});
}

function setSubjectStats(stats) {
  writeStorage(SUBJECT_STATS_KEY, stats);
}

function getQuestionStats() {
  return readStorage(QUESTION_STATS_KEY, {});
}

function setQuestionStats(stats) {
  writeStorage(QUESTION_STATS_KEY, stats);
}

function getQuestionStat(questionId) {
  const stats = getQuestionStats();
  return stats[questionId] ?? { wrongCount: 0 };
}

function weaknessLabel(wrongCount) {
  if (wrongCount >= 3) return "必背題";
  if (wrongCount >= 2) return "弱點題";
  return "";
}

function activeStreak(progress) {
  const today = todayKey();
  if (progress.lastCompletedDate === today || progress.lastCompletedDate === dateBefore(today)) {
    return progress.streak;
  }
  return 0;
}

function selectedPool() {
  const subject = els.subjectSelect.value;
  if (subject === ALL_SUBJECTS) return state.allQuestions;
  return state.allQuestions.filter((item) => item.subject === subject);
}

function shuffle(items) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function showMessage(text) {
  els.loadMessage.textContent = text;
  els.loadMessage.hidden = !text;
}

function setView(view) {
  Object.entries(els.views).forEach(([name, element]) => {
    element.hidden = name !== view;
  });

  els.navItems.forEach((item) => {
    const active = item.dataset.view === view;
    item.classList.toggle("active", active);
  });

  document.body.classList.toggle("in-quiz", view === "quiz" || view === "result");
  if (view === "home" || view === "start" || view === "wrongbook" || view === "stats") {
    updateDashboard();
  }
}

function populateSubjects() {
  const subjects = [...new Set(state.allQuestions.map((item) => item.subject))].sort();
  els.subjectSelect.innerHTML = "";

  const allOption = document.createElement("option");
  allOption.value = ALL_SUBJECTS;
  allOption.textContent = `全部科目（${state.allQuestions.length} 題）`;
  els.subjectSelect.appendChild(allOption);

  subjects.forEach((subject) => {
    const option = document.createElement("option");
    const count = state.allQuestions.filter((item) => item.subject === subject).length;
    option.value = subject;
    option.textContent = `${subject}（${count} 題）`;
    els.subjectSelect.appendChild(option);
  });
}

function updateSubjectStat(question, isCorrect) {
  const stats = getSubjectStats();
  const current = stats[question.subject] ?? { total: 0, correct: 0 };
  current.total += 1;
  if (isCorrect) current.correct += 1;
  stats[question.subject] = current;
  setSubjectStats(stats);
}

function updateQuestionWrongStat(question, isCorrect) {
  if (isCorrect) return getQuestionStat(question.id);

  const stats = getQuestionStats();
  const current = stats[question.id] ?? { wrongCount: 0 };
  current.wrongCount += 1;
  stats[question.id] = current;
  setQuestionStats(stats);
  return current;
}

function completeDailyMissionIfNeeded(totalAnswered) {
  if (totalAnswered < QUESTION_COUNT) return;

  const today = todayKey();
  const progress = getDailyProgress();
  if (progress.completedDates.includes(today)) return;

  const completedDates = [...new Set([...progress.completedDates, today])].sort();
  const yesterday = dateBefore(today);
  const streak = progress.lastCompletedDate === yesterday ? progress.streak + 1 : 1;

  setDailyProgress({
    completedDates,
    streak,
    totalCompletedDays: completedDates.length,
    lastCompletedDate: today,
  });
}

function updateDashboard() {
  const wrongIds = getWrongIds();
  const progress = getDailyProgress();
  const today = todayKey();
  const completedToday = progress.completedDates.includes(today);
  const streak = activeStreak(progress);

  els.topTodayStatus.textContent = completedToday ? "今日完成" : "今日未完成";
  els.topTodayStatus.classList.toggle("done", completedToday);
  els.heroTodayStatus.textContent = completedToday ? "已完成" : "未完成";
  els.heroTodayStatus.classList.toggle("done", completedToday);
  els.heroStreak.textContent = `${streak} 天`;
  els.heroTotalCount.textContent = state.allQuestions.length || "--";
  els.homeWrongCount.textContent = wrongIds.length;
  els.streakCount.textContent = streak;
  els.dailySummary.textContent = `總完成天數：${progress.totalCompletedDays} 天`;
  els.wrongCount.textContent = `錯題：${wrongIds.length} 題`;
  els.startWrong.disabled = wrongIds.length === 0;
  els.homeStartWrong.disabled = wrongIds.length === 0;
  els.wrongbookStart.disabled = wrongIds.length === 0;

  renderWrongbook();
  renderSubjectStats();
}

function renderWrongbook() {
  const ids = new Set(getWrongIds());
  const wrongQuestions = state.allQuestions.filter((item) => ids.has(item.id));
  els.wrongbookList.innerHTML = "";

  if (wrongQuestions.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = "目前沒有錯題。答錯的題目會自動收進這裡。";
    els.wrongbookList.appendChild(empty);
    return;
  }

  wrongQuestions.slice(0, 60).forEach((question) => {
    const wrongCount = getQuestionStat(question.id).wrongCount || 0;
    const label = weaknessLabel(wrongCount);
    const item = document.createElement("article");
    item.className = "compact-item";

    const title = document.createElement("strong");
    title.textContent = question.question;

    const meta = document.createElement("span");
    meta.textContent = `${question.subject}${label ? ` · ${label}` : ""}${wrongCount ? ` · 錯 ${wrongCount} 次` : ""}`;

    item.append(title, meta);
    els.wrongbookList.appendChild(item);
  });
}

function renderSubjectStats() {
  const stats = getSubjectStats();
  const subjects = Object.keys(stats).sort();
  els.subjectStatsList.innerHTML = "";

  if (subjects.length === 0) {
    els.statsSummary.textContent = "尚無作答紀錄";
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = "開始作答後會顯示各科答對率。";
    els.subjectStatsList.appendChild(empty);
    return;
  }

  const totalAnswered = subjects.reduce((sum, subject) => sum + (Number(stats[subject].total) || 0), 0);
  els.statsSummary.textContent = `累計作答 ${totalAnswered} 題`;

  subjects.forEach((subject) => {
    const item = stats[subject];
    const total = Number(item.total) || 0;
    const correct = Number(item.correct) || 0;
    const rate = total ? Math.round((correct / total) * 100) : 0;

    const row = document.createElement("div");
    row.className = "subject-stat-row";

    const info = document.createElement("div");
    const name = document.createElement("strong");
    const detail = document.createElement("span");
    const meter = document.createElement("div");
    const fill = document.createElement("i");
    const rateText = document.createElement("b");

    name.textContent = subject;
    detail.textContent = `${correct} / ${total} 題`;
    meter.className = "mini-meter";
    fill.style.width = `${rate}%`;
    rateText.textContent = `${rate}%`;

    meter.appendChild(fill);
    info.append(name, detail, meter);
    row.append(info, rateText);
    els.subjectStatsList.appendChild(row);
  });
}

function startQuiz(questions, mode) {
  if (questions.length === 0) {
    showMessage(mode === "wrong" ? "目前沒有錯題可以練習。" : "這個科目目前沒有題目。");
    return;
  }

  state.currentQuestions = questions.slice(0, QUESTION_COUNT);
  state.answers = Array(state.currentQuestions.length).fill("");
  state.results = Array(state.currentQuestions.length).fill(null);
  state.currentIndex = 0;
  state.mode = mode;
  state.previousView = mode === "wrong" ? "wrongbook" : "start";
  els.quizTitle.textContent = mode === "wrong" ? "錯題複習" : "隨機練習";
  showMessage("");
  renderQuestion();
  setView("quiz");
}

function startSelectedRandom() {
  const pool = selectedPool();
  if (pool.length < QUESTION_COUNT) {
    showMessage(`這個範圍只有 ${pool.length} 題，請選「全部科目」或題數較多的科目。`);
    setView("start");
    return;
  }
  startQuiz(shuffle(pool), "random");
}

function startWrongQuiz() {
  const ids = new Set(getWrongIds());
  startQuiz(shuffle(state.allQuestions.filter((item) => ids.has(item.id))), "wrong");
}

function renderQuestion() {
  const question = state.currentQuestions[state.currentIndex];
  const wrongCount = getQuestionStat(question.id).wrongCount || 0;
  const label = weaknessLabel(wrongCount);
  const displaySubject = label ? `${question.subject} · ${label}（錯 ${wrongCount} 次）` : question.subject;

  els.questionNumber.textContent = `第 ${state.currentIndex + 1} 題`;
  els.questionYear.textContent = question.year ? `${question.year} 年` : "初等考試";
  els.subjectBadge.textContent = displaySubject;
  els.questionText.textContent = question.question;
  els.progressText.textContent = `${state.currentIndex + 1} / ${state.currentQuestions.length}`;
  els.progressFill.style.width = `${(state.currentIndex / state.currentQuestions.length) * 100}%`;
  els.feedbackCard.hidden = true;
  els.feedbackCard.className = "feedback-card";
  els.feedbackTitle.textContent = "";
  els.feedbackAnswer.innerHTML = "";
  els.feedbackExplanation.innerHTML = "";
  els.continueQuiz.disabled = true;
  els.continueQuiz.textContent = "先選一個答案";

  els.options.innerHTML = "";
  Object.entries(question.options).forEach(([key, text]) => {
    const labelElement = document.createElement("label");
    labelElement.className = "option";
    labelElement.dataset.option = key;

    const input = document.createElement("input");
    input.type = "radio";
    input.name = "answer";
    input.value = key;

    const optionKey = document.createElement("span");
    optionKey.className = "option-key";
    optionKey.textContent = key;

    const optionText = document.createElement("span");
    optionText.className = "option-text";
    optionText.textContent = text;

    labelElement.append(input, optionKey, optionText);
    labelElement.addEventListener("click", () => chooseAnswer(key));
    els.options.appendChild(labelElement);
  });
}

function chooseAnswer(answer) {
  if (state.results[state.currentIndex] !== null) return;

  const question = state.currentQuestions[state.currentIndex];
  const isCorrect = answer === question.answer;
  const wrongIds = getWrongIds();

  state.answers[state.currentIndex] = answer;
  state.results[state.currentIndex] = isCorrect;
  updateSubjectStat(question, isCorrect);
  const questionStat = updateQuestionWrongStat(question, isCorrect);

  if (isCorrect) {
    const found = wrongIds.indexOf(question.id);
    if (found >= 0) wrongIds.splice(found, 1);
  } else {
    wrongIds.push(question.id);
  }

  setWrongIds(wrongIds);
  renderFeedback(question, answer, isCorrect, questionStat.wrongCount || 0);
}

function renderFeedback(question, answer, isCorrect, wrongCount) {
  els.options.querySelectorAll(".option").forEach((option) => {
    const key = option.dataset.option;
    option.classList.toggle("selected", key === answer);
    option.classList.toggle("correct-answer", key === question.answer);
    option.classList.toggle("wrong-answer", key === answer && !isCorrect);
    option.querySelector("input").checked = key === answer;
  });

  const label = weaknessLabel(wrongCount);
  els.feedbackCard.hidden = false;
  els.feedbackCard.classList.add(isCorrect ? "correct" : "wrong");
  els.feedbackTitle.textContent = `${isCorrect ? "答對了" : "答錯了"}：你選 ${answer}，正解 ${question.answer}`;
  renderAnalysisCard(question, answer, isCorrect, label, wrongCount);
  els.continueQuiz.disabled = false;
  els.continueQuiz.textContent = state.currentIndex === state.currentQuestions.length - 1 ? "看本次成果" : "下一題";
  els.progressFill.style.width = `${((state.currentIndex + 1) / state.currentQuestions.length) * 100}%`;
}

function appendAnalysisItem(parent, title, body, extra = "") {
  const item = document.createElement("section");
  item.className = "analysis-item";

  const heading = document.createElement("h3");
  heading.textContent = title;

  if (Array.isArray(body)) {
    const list = document.createElement("div");
    list.className = "option-analysis-list";
    body.forEach(({ label, text }) => {
      const row = document.createElement("p");
      const key = document.createElement("b");
      const detail = document.createElement("span");
      key.textContent = label;
      detail.textContent = text;
      row.append(key, detail);
      list.appendChild(row);
    });
    item.append(heading, list);
  } else {
    const content = document.createElement("p");
    content.textContent = body;
    item.append(heading, content);
  }


  if (extra) {
    const note = document.createElement("small");
    note.textContent = extra;
    item.appendChild(note);
  }

  parent.appendChild(item);
}

function appendExamPoint(parent, point) {
  const item = document.createElement("section");
  item.className = "analysis-item exam-point";

  const heading = document.createElement("h3");
  heading.textContent = "🎯 本題考點";

  const grid = document.createElement("div");
  grid.className = "exam-point-grid";

  [
    ["科目", point.subject],
    ["主題", point.topic],
    ["子主題", point.subTopic],
    ["常考程度", point.frequency],
  ].forEach(([label, value]) => {
    const cell = document.createElement("p");
    const key = document.createElement("b");
    const text = document.createElement("span");
    key.textContent = label;
    text.textContent = value;
    cell.append(key, text);
    grid.appendChild(cell);
  });

  item.append(heading, grid);
  parent.appendChild(item);
}

function appendSteps(parent, steps) {
  const item = document.createElement("section");
  item.className = "analysis-item";

  const heading = document.createElement("h3");
  heading.textContent = "🧠 老師怎麼判斷？";

  const list = document.createElement("ol");
  list.className = "thinking-steps";
  steps.forEach((step) => {
    const row = document.createElement("li");
    row.textContent = step;
    list.appendChild(row);
  });

  item.append(heading, list);
  parent.appendChild(item);
}

function cleanSourceOnlyExplanation(text, answer) {
  const value = String(text || "").trim();
  if (!value) return "";
  const sourceOnly = new RegExp(`^官方答案[:：]?\\s*${answer}[。；;\\s]*(來源[:：].*)?$`);
  if (sourceOnly.test(value)) return "";
  return value.replace(/^官方答案[:：]?\s*[A-D][。；;\s]*/, "").replace(/來源[:：].*$/, "").trim();
}

function getKeywords(question) {
  if (Array.isArray(question.keywords)) return question.keywords.join("、");
  if (question.keywords) return String(question.keywords);

  const quoted = question.question.match(/[「『](.*?)[」』]/g);
  if (quoted?.length) return quoted.map((item) => item.replace(/[「」『』]/g, "")).slice(0, 3).join("、");
  return ["題幹問法", "關鍵名詞", "最直接回答", "排除干擾"];
}

function keywordText(question) {
  const keywords = getKeywords(question);
  if (Array.isArray(keywords)) return keywords.slice(0, 5).join("、");
  return keywords;
}

function stripSubjectYear(subject) {
  return String(subject || "").replace(/（.*?）/g, "");
}

function inferTopic(question) {
  const subject = stripSubjectYear(question.subject);
  const text = question.question;
  if (subject.includes("國文")) {
    if (text.includes("成語")) return "成語語意與語境判斷";
    if (text.includes("字") || text.includes("意義")) return "字義辨析";
    if (text.includes("冗贅")) return "語病與贅詞判斷";
    if (text.includes("根據上文") || text.includes("上文")) return "閱讀理解與文意推論";
    return "語文理解與用法判斷";
  }
  if (subject.includes("英文")) return "英文文意與語法判斷";
  if (subject.includes("公民")) return "公民概念與制度判斷";
  if (subject.includes("法學")) return "法律概念與制度判斷";
  if (subject.includes("行政學")) return "行政學基本概念判斷";
  return `${subject}核心概念判斷`;
}

function inferSubTopic(question) {
  const text = question.question;
  if (text.includes("何者正確")) return "找出正確敘述";
  if (text.includes("何者錯誤") || text.includes("何者有誤")) return "找出錯誤敘述";
  if (text.includes("何者最")) return "找出最符合題意的選項";
  if (text.includes("意義與其他")) return "比較字詞意義是否相同";
  if (text.includes("替換") || text.includes("文意不變")) return "同義替換與語境一致";
  if (text.includes("根據上文")) return "依原文資訊判斷選項";
  return "題幹關鍵字與選項比對";
}

function inferQuestionAsk(question) {
  if (question.question.includes("何者正確")) return "哪一個選項的敘述正確";
  if (question.question.includes("何者錯誤") || question.question.includes("何者有誤")) return "哪一個選項的敘述錯誤";
  if (question.question.includes("何者最")) return "哪一個選項最符合題幹";
  if (question.question.includes("下列")) return "在下列選項中找出最符合題幹的敘述";
  return "題幹真正要求你判斷的核心概念";
}

function inferOptionRole(optionText) {
  const text = String(optionText || "");
  if (text.length <= 14) return `「${text}」這個概念或名詞`;
  return `「${text}」這段敘述`;
}

function quotedTerms(text) {
  return [...String(text || "").matchAll(/[「『](.*?)[」』]/g)].map((match) => match[1]).filter(Boolean);
}

const TERM_NOTES = {
  行不由徑: "正面詞，指做人做事正直，不走旁門左道。",
  拾人牙慧: "負面詞，指撿別人說過的話來講，沒有自己的見解。",
  群起效尤: "多作負面詞，指大家跟著做不好的事。",
  事半功倍: "正面詞，指方法對、效率高，花較少力氣得到較大成果。",
  美輪美奐: "形容建築物高大華美，通常不拿來形容自然風景。",
  目無全牛: "形容技藝純熟，不是沒有全局觀。",
  始作俑者: "指壞風氣或壞事的開端者，多用於負面情境。",
  相敬如賓: "形容夫妻互相尊敬，是正面用法。",
  真知灼見: "指正確而深刻的見解。",
  略陳管見: "謙稱自己粗淺的看法，程度比真知灼見低。",
  小心翼翼: "形容謹慎小心。",
  謹言慎行: "指說話和行動都謹慎，重點不只在操作小心。",
  玩日愒歲: "指虛度光陰、苟且度日。",
  年深月久: "指時間久遠，不等於虛度時間。",
  刻舟求劍: "比喻拘泥成法，不知變通。",
  膠柱鼓瑟: "比喻拘泥固執，不知變通。",
};

function termNote(term) {
  return TERM_NOTES[term] || "";
}

function idiomMismatchExplanation(term, optionText) {
  const text = String(optionText || "");
  if (term === "行不由徑" && /信用|形象|打折|旁門|歪/.test(text)) {
    return "句子在講信用和形象變差，是負面情境；但「行不由徑」是正面詞，指人正直不走歪路，方向剛好不合。";
  }
  if (term === "拾人牙慧" && /獨特|個人|見解|想法/.test(text)) {
    return "句子說這個人有獨特想法，但「拾人牙慧」是撿別人的話來講、沒有自己見解，意思剛好相反。";
  }
  if (term === "群起效尤" && /正直|端正|上司|下屬/.test(text)) {
    return "句子是上司正直、下屬跟著學的正面情境；但「群起效尤」多半用在大家跟著做壞事，褒貶色彩不合。";
  }
  if (term === "美輪美奐" && /風景|山水|自然/.test(text)) {
    return "句子在講自然風景，但「美輪美奐」主要形容建築物高大華美，用在風景上不精準。";
  }
  if (term === "目無全牛" && /胡亂|想像|全局|未來/.test(text)) {
    return "句子想說不要胡亂想像或缺乏全局，但「目無全牛」其實是技藝純熟的正面成語，不是沒有全局觀。";
  }
  return "";
}

function optionFocus(optionText) {
  const quoted = quotedTerms(optionText);
  if (quoted.length) return quoted.join("、");
  const text = String(optionText || "").replace(/\s+/g, " ").trim();
  return text.length > 24 ? `${text.slice(0, 24)}...` : text;
}

function correctReason(question) {
  const ask = inferQuestionAsk(question);
  const answer = question.answer;
  const option = question.options[answer];
  const subject = stripSubjectYear(question.subject);
  const focus = optionFocus(option);

  if (subject.includes("國文") && question.question.includes("成語")) {
    const note = termNote(focus);
    return note
      ? `題目要你判斷成語放進句子後，意思和情境合不合。正解 ${answer} 的「${focus}」意思是：${note} 題目說先計畫周全再執行，剛好對到「方法對、效率高、成果好」這個方向，所以選 ${answer}。`
      : `題目要你判斷成語放進句子後，語氣和意思合不合。正解 ${answer} 的關鍵是「${focus}」和整句語境接得起來，所以不是只看成語熟不熟，而是看它放在那句話裡順不順、準不準。`;
  }
  if (subject.includes("國文") && (question.question.includes("意義") || question.question.includes("字"))) {
    return `題目要比的是字詞在句子裡的實際意思。正解 ${answer} 的「${focus}」和其他選項的用法不同或最符合題目要求，所以要把字放回原句看，不要只背單一字面意思。`;
  }
  if (subject.includes("國文") && (question.question.includes("根據上文") || question.question.includes("上文"))) {
    return `題目問的是能不能從原文推出選項。正解 ${answer} 的重點是「${focus}」最符合原文資訊；閱讀題不要憑印象補劇情，要回到文章找有沒有直接或合理支持。`;
  }
  return `題目問的是「${ask}」。正解 ${answer} 的重點是「${focus}」，它最直接回答題幹要求；解這類題不是看哪個詞最熟，而是看哪個選項真的扣回題目在問的那件事。`;
}

function fallbackOptionAnalysis(question, key) {
  const ask = inferQuestionAsk(question);
  const option = question.options[key];
  const role = inferOptionRole(option);
  const focus = optionFocus(option);
  const subject = stripSubjectYear(question.subject);

  if (subject.includes("國文") && question.question.includes("成語")) {
    const note = termNote(focus);
    const mismatch = idiomMismatchExplanation(focus, option);
    return note
      ? `${key} 的關鍵成語是「${focus}」，白話意思是：${note} ${mismatch || "它容易誤選，是因為這個成語看起來很熟；但放回句子後，句子的情境和成語真正意思沒有對上，所以不能選。"}`
      : `${key} 說的是 ${role}。它容易誤選，是因為句子看起來通順或成語很熟；但成語題要檢查「${focus}」的意思是否真的貼合前後文。這個選項的問題就在於成語語意和句子要表達的重點沒有完全對上。`;
  }
  if (subject.includes("國文") && (question.question.includes("意義") || question.question.includes("字"))) {
    return `${key} 的重點是「${focus}」。字義題不能只看字面，要看它在該句裡扮演的意思；這個選項沒有符合題目要比較的那個用法，所以會被排除。`;
  }
  if (subject.includes("國文") && (question.question.includes("根據上文") || question.question.includes("上文"))) {
    return `${key} 提到的是「${focus}」。閱讀題要問：原文有沒有支持這句話？這個選項容易誤選，是因為它看似和文章主題有關，但沒有精準對到題幹要求或原文資訊。`;
  }

  return `${key} 說的是 ${role}。它可能和題目領域有關，所以看起來像答案；但本題要判斷的是「${ask}」，這個選項沒有正面回答題幹。下次看到這種選項，要先問：它是在回答題目，還是只是在旁邊講一個相關概念？`;
}

function shortOptionText(question, key) {
  return `${key}「${optionFocus(question.options[key])}」`;
}

function distractorSummary(question) {
  const wrongOptions = ["A", "B", "C", "D"].filter((key) => key !== question.answer);
  return wrongOptions.map((key) => shortOptionText(question, key)).join("、");
}

function buildThinkingSteps(question) {
  const answer = question.answer;
  const ask = inferQuestionAsk(question);
  const subject = stripSubjectYear(question.subject);
  const correct = shortOptionText(question, answer);
  const distractors = distractorSummary(question);

  if (subject.includes("國文") && question.question.includes("成語")) {
    const idiomNotes = ["A", "B", "C", "D"]
      .map((key) => {
        const term = optionFocus(question.options[key]);
        const note = termNote(term);
        return note ? `${key}「${term}」：${note}` : "";
      })
      .filter(Boolean)
      .join(" ");
    const mismatchNotes = ["A", "B", "C", "D"]
      .filter((key) => key !== answer)
      .map((key) => {
        const term = optionFocus(question.options[key]);
        const mismatch = idiomMismatchExplanation(term, question.options[key]);
        return mismatch ? `${key}：${mismatch}` : "";
      })
      .filter(Boolean)
      .join(" ");
    return [
      `① 這題不是問哪個成語你看過，而是問「哪個成語放進句子後意思正確」。`,
      idiomNotes ? `② 先把四個成語翻成白話：${idiomNotes}` : `② 先抓正解 ${correct}：它的語意要能和句子的情境同方向，不能只是字面看起來漂亮。`,
      mismatchNotes ? `③ 再對句子情境：${mismatchNotes}` : `③ 再對句子情境：${distractors} 的問題通常是褒貶方向或真正意思和句子不合。`,
      `④ 所以最後選 ${answer}，標準是：成語原意、褒貶色彩、前後文情境三個都要對上。`,
    ];
  }

  if (subject.includes("國文") && (question.question.includes("意義") || question.question.includes("字"))) {
    return [
      `① 題目要比的是字詞在原句中的意思，不是查字典背第一個解釋。`,
      `② 先抓正解 ${correct}：把它放回句子，判斷它在那裡到底表示動作、狀態，還是結果。`,
      `③ 再比 ${distractors}：這些選項容易混，是因為字一樣，但放在不同句子裡意思會變。`,
      `④ 所以選 ${answer}，因為它的語境用法最符合題目要你找的那一類。`,
    ];
  }

  if (subject.includes("國文") && (question.question.includes("根據上文") || question.question.includes("上文"))) {
    return [
      `① 閱讀題先問：這個選項能不能被原文支持，不要用自己的常識腦補。`,
      `② 正解 ${correct} 是最能對回文章資訊的選項，通常可以在原文找到對應句或合理推論。`,
      `③ ${distractors} 可能看起來和主題有關，但只要原文沒有講到、講太滿、或方向相反，就要刪掉。`,
      `④ 所以選 ${answer}，判斷標準是「原文有沒有支撐」，不是「我覺得好像合理」。`,
    ];
  }

  return [
    `① 本題問的是「${ask}」，所以先把題幹要你判斷的對象圈出來。`,
    `② 正解 ${correct} 的重點最直接扣住題幹，這是它能當答案的原因。`,
    `③ 干擾選項 ${distractors} 常見問題是只講到相關概念，卻沒有正面回答題幹。`,
    `④ 所以最後選 ${answer}：考場上不要選「看起來熟」的，要選「最直接回答題目」的。`,
  ];
}

function buildTeacherAnalysis(question, isCorrect, label, wrongCount) {
  const answer = question.answer;
  const answerText = question.options[answer];
  const cleanedExplanation = cleanSourceOnlyExplanation(question.explanation, answer);
  const topic = question.topic || question.concept || inferTopic(question);
  const subTopic = question.subTopic || question.keyPoint || inferSubTopic(question);
  const frequency = question.frequency || "★★★☆☆";
  const ask = inferQuestionAsk(question);
  const wrongNote = label ? `這題已累計錯 ${wrongCount} 次，先把判斷規則釘住。` : "";

  const examPoint = {
    subject: question.subject,
    topic,
    subTopic,
    frequency,
  };

  const thinkingSteps = Array.isArray(question.thinkingSteps) && question.thinkingSteps.length
    ? question.thinkingSteps
    : buildThinkingSteps(question);

  const plainExplanation =
    question.plainExplanation ||
    (cleanedExplanation
      ? `題目問的是「${ask}」。答案 ${answer} 的「${answerText}」最能對上題幹要求；白話說，就是先抓題目要你判斷的點，再用這個觀念去看選項是否真的回答問題。補充觀念：${cleanedExplanation}`
      : correctReason(question));

  const optionAnalysis = ["A", "B", "C", "D"]
    .filter((key) => key !== answer)
    .map((key) => ({
      label: `${key}：`,
      text: question.optionAnalysis?.[key] || fallbackOptionAnalysis(question, key),
    }));

  const memoryTip =
    question.memoryTip ||
    `口訣：先問題目要什麼，再選最直接回答它的選項；看到熟悉字，不等於它就是答案。`;

  const keywords = keywordText(question);

  return {
    examPoint,
    thinkingSteps,
    plainExplanation: wrongNote ? `${plainExplanation} ${wrongNote}` : plainExplanation,
    optionAnalysis,
    memoryTip,
    keywords,
    conceptNote: question.concept ? `核心觀念：${question.concept}` : `主題：${topic}`,
    statusNote: isCorrect ? "你這題方向抓對了，接著記判斷流程。" : "這題錯在判斷點被干擾，先把排除理由看完。",
  };
}

function renderAnalysisCard(question, answer, isCorrect, label, wrongCount) {
  els.feedbackAnswer.innerHTML = "";
  els.feedbackExplanation.innerHTML = "";

  if (!question.hasTeacherExplanation) {
    els.feedbackCard.classList.add("pending-analysis");
    appendAnalysisItem(
      els.feedbackExplanation,
      "這題還沒有正式 AI 老師解析",
      "目前題庫只有官方答案，舊版那種模板解析我先拿掉，避免你看了更混亂。這題會等批次重生後補上真正白話、逐選項的解析。"
    );
    appendAnalysisItem(
      els.feedbackExplanation,
      "先看正解",
      `你選 ${answer}，正解是 ${question.answer}「${question.options[question.answer]}」。`
    );
    return;
  }

  const analysis = buildTeacherAnalysis(question, isCorrect, label, wrongCount);

  appendExamPoint(els.feedbackExplanation, analysis.examPoint);
  appendSteps(els.feedbackExplanation, analysis.thinkingSteps);
  appendAnalysisItem(els.feedbackExplanation, `✅ 為什麼正解是 ${question.answer}？`, analysis.plainExplanation, analysis.conceptNote);
  appendAnalysisItem(els.feedbackExplanation, "❌ 其他選項為什麼錯？", analysis.optionAnalysis);
  appendAnalysisItem(els.feedbackExplanation, "📝 記憶口訣", analysis.memoryTip);
  appendAnalysisItem(els.feedbackExplanation, "🔑 下次看到這題要抓的關鍵字", analysis.keywords);
}

function finishQuiz() {
  const correct = state.results.filter(Boolean).length;
  completeDailyMissionIfNeeded(state.currentQuestions.length);
  updateDashboard();
  renderResult(correct);
  setView("result");
}

function appendText(parent, tagName, text, className = "") {
  const element = document.createElement(tagName);
  if (className) element.className = className;
  element.textContent = text;
  parent.appendChild(element);
  return element;
}

function encouragement(rate) {
  if (rate >= 90) return "很穩，這回合像在收分。";
  if (rate >= 75) return "節奏不錯，把錯題再補一輪就更漂亮。";
  if (rate >= 60) return "有底了，今天把解析吃下來很有價值。";
  return "先把錯題收好，下一輪會更準。";
}

function renderResult(correct) {
  const total = state.currentQuestions.length;
  const wrong = total - correct;
  const rate = total ? Math.round((correct / total) * 100) : 0;
  els.scoreRate.textContent = `${correct} / ${total}`;
  els.scoreDetail.textContent = `答對率 ${rate}%`;
  els.resultWrongCount.textContent = wrong;
  els.resultRateSmall.textContent = `${rate}%`;
  els.resultEncouragement.textContent = encouragement(rate);
  els.reviewList.innerHTML = "";

  state.currentQuestions.forEach((question, index) => {
    const userAnswer = state.answers[index] || "未作答";
    const isCorrect = state.results[index] === true;
    const wrongCount = getQuestionStat(question.id).wrongCount || 0;
    const label = weaknessLabel(wrongCount);
    const card = document.createElement("article");
    card.className = `review-item ${isCorrect ? "correct" : "wrong"}`;

    appendText(card, "p", label ? `${question.subject} · ${label}（錯 ${wrongCount} 次）` : question.subject, "badge");
    appendText(card, "h3", `${index + 1}. ${question.question}`);
    appendText(card, "p", `你的答案：${userAnswer}`);
    appendText(card, "p", `正確答案：${question.answer}`);
    appendText(card, "p", question.explanation, "explanation");
    els.reviewList.appendChild(card);
  });
}

els.navItems.forEach((item) => {
  item.addEventListener("click", () => setView(item.dataset.view));
});

els.startRandom.addEventListener("click", startSelectedRandom);
els.homeStartRandom.addEventListener("click", startSelectedRandom);
els.startWrong.addEventListener("click", startWrongQuiz);
els.homeStartWrong.addEventListener("click", startWrongQuiz);
els.wrongbookStart.addEventListener("click", startWrongQuiz);

els.continueQuiz.addEventListener("click", () => {
  if (state.results[state.currentIndex] === null) return;
  if (state.currentIndex < state.currentQuestions.length - 1) {
    state.currentIndex += 1;
    renderQuestion();
  } else {
    finishQuiz();
  }
});

els.backHome.addEventListener("click", () => setView(state.previousView));
els.resultHome.addEventListener("click", () => setView("home"));
els.retrySame.addEventListener("click", () => startQuiz(state.currentQuestions, state.mode));

loadQuestions()
  .then((questions) => {
    state.allQuestions = questions;
    populateSubjects();
    updateDashboard();
    showMessage(`題庫已載入：${questions.length} 題`);
  })
  .catch((error) => {
    showMessage(error.message);
    els.startRandom.disabled = true;
    els.homeStartRandom.disabled = true;
    els.startWrong.disabled = true;
    els.homeStartWrong.disabled = true;
    els.wrongbookStart.disabled = true;
  });
