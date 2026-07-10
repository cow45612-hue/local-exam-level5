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
};

const els = {
  setupView: document.querySelector("#setup-view"),
  quizView: document.querySelector("#quiz-view"),
  resultView: document.querySelector("#result-view"),
  subjectSelect: document.querySelector("#subject-select"),
  startRandom: document.querySelector("#start-random"),
  startWrong: document.querySelector("#start-wrong"),
  questionCountStat: document.querySelector("#question-count-stat"),
  homeTotalCount: document.querySelector("#home-total-count"),
  homeWrongCount: document.querySelector("#home-wrong-count"),
  todayStatus: document.querySelector("#today-status"),
  streakCount: document.querySelector("#streak-count"),
  dailySummary: document.querySelector("#daily-summary"),
  subjectStatsList: document.querySelector("#subject-stats-list"),
  wrongCount: document.querySelector("#wrong-count"),
  loadMessage: document.querySelector("#load-message"),
  quizTitle: document.querySelector("#quiz-title"),
  progressText: document.querySelector("#progress-text"),
  progressFill: document.querySelector("#progress-fill"),
  backHome: document.querySelector("#back-home"),
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
  retrySame: document.querySelector("#retry-same"),
  resultHome: document.querySelector("#result-home"),
  reviewList: document.querySelector("#review-list"),
};

function normalizeQuestion(raw, index) {
  return {
    id: String(raw.id ?? index + 1),
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
  updateWrongCount();
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

function updateWrongCount() {
  const ids = getWrongIds();
  els.wrongCount.textContent = `錯題：${ids.length} 題`;
  els.homeWrongCount.textContent = ids.length;
  els.startWrong.disabled = ids.length === 0;
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

function showMessage(text) {
  els.loadMessage.textContent = text;
  els.loadMessage.hidden = !text;
}

function switchView(view) {
  els.setupView.hidden = view !== "setup";
  els.quizView.hidden = view !== "quiz";
  els.resultView.hidden = view !== "result";
  if (view === "setup") updateDashboard();
}

function shuffle(items) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function selectedPool() {
  const subject = els.subjectSelect.value;
  if (subject === ALL_SUBJECTS) return state.allQuestions;
  return state.allQuestions.filter((item) => item.subject === subject);
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

function updateDashboard() {
  const progress = getDailyProgress();
  const today = todayKey();
  const completedToday = progress.completedDates.includes(today);

  els.questionCountStat.textContent = state.allQuestions.length || "--";
  els.homeTotalCount.textContent = state.allQuestions.length || "--";
  els.todayStatus.textContent = completedToday ? "已完成" : "未完成";
  els.todayStatus.classList.toggle("done", completedToday);
  els.streakCount.textContent = `${activeStreak(progress)} 天`;
  els.dailySummary.textContent = `總完成天數：${progress.totalCompletedDays} 天`;
  updateWrongCount();
  renderSubjectStats();
}

function renderSubjectStats() {
  const stats = getSubjectStats();
  const subjects = Object.keys(stats).sort();
  els.subjectStatsList.innerHTML = "";

  if (subjects.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = "開始作答後會顯示各科統計。";
    els.subjectStatsList.appendChild(empty);
    return;
  }

  subjects.forEach((subject) => {
    const item = stats[subject];
    const total = Number(item.total) || 0;
    const correct = Number(item.correct) || 0;
    const rate = total ? Math.round((correct / total) * 100) : 0;

    const row = document.createElement("div");
    row.className = "subject-stat-row";

    const textGroup = document.createElement("div");
    const subjectName = document.createElement("strong");
    const detail = document.createElement("span");
    const rateText = document.createElement("b");

    subjectName.textContent = subject;
    detail.textContent = `${correct} / ${total} 題`;
    rateText.textContent = `${rate}%`;

    textGroup.append(subjectName, detail);
    row.append(textGroup, rateText);
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
  els.quizTitle.textContent = mode === "wrong" ? "錯題練習" : "隨機練習";
  showMessage("");
  renderQuestion();
  switchView("quiz");
}

function renderQuestion() {
  const question = state.currentQuestions[state.currentIndex];
  const wrongCount = getQuestionStat(question.id).wrongCount || 0;
  const label = weaknessLabel(wrongCount);

  els.subjectBadge.textContent = question.subject;
  els.questionText.textContent = question.question;
  els.progressText.textContent = `第 ${state.currentIndex + 1} / ${state.currentQuestions.length} 題`;
  els.progressFill.style.width = `${(state.currentIndex / state.currentQuestions.length) * 100}%`;
  els.feedbackCard.hidden = true;
  els.feedbackCard.className = "feedback-card";
  els.feedbackTitle.textContent = "";
  els.feedbackAnswer.textContent = "";
  els.feedbackExplanation.textContent = "";
  els.continueQuiz.disabled = true;
  els.continueQuiz.textContent = "先選一個答案";

  if (label) {
    els.subjectBadge.textContent = `${question.subject} · ${label}（錯 ${wrongCount} 次）`;
  }

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
  updateDashboard();
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
  els.feedbackAnswer.textContent = `正確答案：${question.answer}`;
  els.feedbackExplanation.textContent = label ? `${label}，累計錯 ${wrongCount} 次。${question.explanation}` : question.explanation;
  els.continueQuiz.disabled = false;
  els.continueQuiz.textContent = state.currentIndex === state.currentQuestions.length - 1 ? "看本次成績" : "下一題";
  els.progressFill.style.width = `${((state.currentIndex + 1) / state.currentQuestions.length) * 100}%`;
}

function finishQuiz() {
  const correct = state.results.filter(Boolean).length;
  completeDailyMissionIfNeeded(state.currentQuestions.length);
  updateDashboard();
  renderResult(correct);
  switchView("result");
}

function appendText(parent, tagName, text, className = "") {
  const element = document.createElement(tagName);
  if (className) element.className = className;
  element.textContent = text;
  parent.appendChild(element);
  return element;
}

function renderResult(correct) {
  const total = state.currentQuestions.length;
  const rate = total ? Math.round((correct / total) * 100) : 0;
  els.scoreRate.textContent = `${rate}%`;
  els.scoreDetail.textContent = `答對 ${correct} / ${total} 題`;
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

els.startRandom.addEventListener("click", () => {
  const pool = selectedPool();
  if (pool.length < QUESTION_COUNT) {
    showMessage(`這個範圍只有 ${pool.length} 題，請選「全部科目」或題數較多的科目。`);
    return;
  }
  startQuiz(shuffle(pool), "random");
});

els.startWrong.addEventListener("click", () => {
  const ids = new Set(getWrongIds());
  startQuiz(shuffle(state.allQuestions.filter((item) => ids.has(item.id))), "wrong");
});

els.continueQuiz.addEventListener("click", () => {
  if (state.results[state.currentIndex] === null) return;
  if (state.currentIndex < state.currentQuestions.length - 1) {
    state.currentIndex += 1;
    renderQuestion();
  } else {
    finishQuiz();
  }
});

els.backHome.addEventListener("click", () => switchView("setup"));
els.resultHome.addEventListener("click", () => switchView("setup"));
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
    els.startWrong.disabled = true;
  });
