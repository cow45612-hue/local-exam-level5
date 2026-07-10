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
    keyPoint: raw.keyPoint ?? "",
    topic: raw.topic ?? "",
    subTopic: raw.subTopic ?? "",
    frequency: raw.frequency ?? "",
    thinkingSteps: raw.thinkingSteps ?? [],
    plainExplanation: raw.plainExplanation ?? "",
    optionAnalysis: raw.optionAnalysis ?? {},
    memoryTip: raw.memoryTip ?? "",
    keywords: raw.keywords ?? "",
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

function fallbackOptionAnalysis(question, key) {
  const ask = inferQuestionAsk(question);
  const role = inferOptionRole(question.options[key]);
  return `${role}看起來也和本科有關，所以容易讓人想選。可是本題要判斷的是「${ask}」，這個選項沒有直接扣回題幹的核心要求；考場上要先問自己：它是在回答題目，還是只是出現了熟悉的名詞？`;
}

function buildTeacherAnalysis(question, isCorrect, label, wrongCount) {
  const answer = question.answer;
  const answerText = question.options[answer];
  const cleanedExplanation = cleanSourceOnlyExplanation(question.explanation, answer);
  const topic = question.topic || question.concept || question.subject;
  const subTopic = question.subTopic || question.keyPoint || "題幹判斷與選項排除";
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
    : [
        `① 先看題幹問什麼：本題要找的是「${ask}」。`,
        `② 抓關鍵字：${keywordText(question)}。`,
        "③ 排除只出現熟悉名詞、但沒有正面回答題幹的選項。",
        `④ 最後選出最直接回答題目的答案：${answer}「${answerText}」。`,
      ];

  const plainExplanation =
    question.plainExplanation ||
    (cleanedExplanation
      ? `題目問的是「${ask}」。答案 ${answer} 的「${answerText}」最能對上題幹要求；白話說，就是先抓題目要你判斷的點，再用這個觀念去看選項是否真的回答問題。補充觀念：${cleanedExplanation}`
      : `題目問的是「${ask}」。答案 ${answer} 的「${answerText}」不是只看起來熟，而是最直接扣住題幹要判斷的方向；其他選項即使有相關名詞，只要沒有正面回答題幹，就要先排除。`);

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
  const analysis = buildTeacherAnalysis(question, isCorrect, label, wrongCount);

  els.feedbackAnswer.innerHTML = "";
  els.feedbackExplanation.innerHTML = "";

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
