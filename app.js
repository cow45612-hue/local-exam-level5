const QUESTION_COUNT = 20;
const WRONG_KEY = "initial-exam-wrong-question-ids";
const DAILY_KEY = "initial-exam-daily-progress";
const SUBJECT_STATS_KEY = "initial-exam-subject-stats";
const QUESTION_STATS_KEY = "initial-exam-question-stats";
const ALL_SUBJECTS = "__all__";

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
};

function normalizeQuestion(raw, index) {
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
    concept: raw.concept ?? "",
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
  els.feedbackTitle.textContent = isCorrect ? "答對了" : "答錯了";
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

  const content = document.createElement("p");
  content.textContent = body;

  item.append(heading, content);

  if (extra) {
    const note = document.createElement("small");
    note.textContent = extra;
    item.appendChild(note);
  }

  parent.appendChild(item);
}

function renderAnalysisCard(question, answer, isCorrect, label, wrongCount) {
  const trapFallback = isCorrect
    ? "這題先記觀念，不要只背答案。"
    : "你可能被相似選項或關鍵字誤導，建議把解析看完再下一題。";
  const trapText = question.trap || trapFallback;
  const conceptText = question.concept ? `核心觀念：${question.concept}` : "";
  const whyText = label ? `${label}，累計錯 ${wrongCount} 次。${question.explanation}` : question.explanation;

  els.feedbackAnswer.innerHTML = "";
  els.feedbackExplanation.innerHTML = "";

  appendAnalysisItem(els.feedbackAnswer, "你的答案", answer);
  appendAnalysisItem(els.feedbackAnswer, "正確答案", question.answer);
  appendAnalysisItem(els.feedbackExplanation, "為什麼這題選這個答案", whyText, conceptText);
  appendAnalysisItem(els.feedbackExplanation, "這題容易錯在哪裡", trapText);
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
