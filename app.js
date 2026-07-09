const QUESTION_COUNT = 20;
const WRONG_KEY = "local-exam-level5-wrong-question-ids";

const state = {
  allQuestions: [],
  currentQuestions: [],
  answers: [],
  currentIndex: 0,
  mode: "random"
};

const els = {
  setupView: document.querySelector("#setup-view"),
  quizView: document.querySelector("#quiz-view"),
  resultView: document.querySelector("#result-view"),
  subjectSelect: document.querySelector("#subject-select"),
  startRandom: document.querySelector("#start-random"),
  startWrong: document.querySelector("#start-wrong"),
  wrongCount: document.querySelector("#wrong-count"),
  loadMessage: document.querySelector("#load-message"),
  quizTitle: document.querySelector("#quiz-title"),
  progressText: document.querySelector("#progress-text"),
  backHome: document.querySelector("#back-home"),
  subjectBadge: document.querySelector("#subject-badge"),
  questionText: document.querySelector("#question-text"),
  options: document.querySelector("#options"),
  prevQuestion: document.querySelector("#prev-question"),
  nextQuestion: document.querySelector("#next-question"),
  submitQuiz: document.querySelector("#submit-quiz"),
  scoreRate: document.querySelector("#score-rate"),
  scoreDetail: document.querySelector("#score-detail"),
  retrySame: document.querySelector("#retry-same"),
  resultHome: document.querySelector("#result-home"),
  reviewList: document.querySelector("#review-list")
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
      D: raw.options?.D ?? raw.D
    },
    answer: String(raw.answer).toUpperCase(),
    explanation: raw.explanation
  };
}

async function loadQuestions() {
  const response = await fetch("./questions.json", { cache: "no-store" });
  if (!response.ok) {
    throw new Error("題庫載入失敗");
  }

  const data = await response.json();
  return data.map(normalizeQuestion).filter((item) => {
    return item.subject && item.question && item.options.A && item.options.B && item.options.C && item.options.D && item.answer && item.explanation;
  });
}

function getWrongIds() {
  try {
    return JSON.parse(localStorage.getItem(WRONG_KEY)) ?? [];
  } catch {
    return [];
  }
}

function setWrongIds(ids) {
  localStorage.setItem(WRONG_KEY, JSON.stringify([...new Set(ids)]));
  updateWrongCount();
}

function updateWrongCount() {
  const ids = getWrongIds();
  els.wrongCount.textContent = `錯題：${ids.length} 題`;
  els.startWrong.disabled = ids.length === 0;
}

function showMessage(message, isError = false) {
  els.loadMessage.textContent = message;
  els.loadMessage.className = isError ? "message error" : "message";
  els.loadMessage.hidden = !message;
}

function showView(name) {
  els.setupView.hidden = name !== "setup";
  els.quizView.hidden = name !== "quiz";
  els.resultView.hidden = name !== "result";
}

function shuffle(items) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function populateSubjects() {
  const subjects = [...new Set(state.allQuestions.map((item) => item.subject))].sort();
  els.subjectSelect.innerHTML = "";

  const allOption = document.createElement("option");
  allOption.value = "__all__";
  allOption.textContent = "全部科目";
  els.subjectSelect.append(allOption);

  subjects.forEach((subject) => {
    const option = document.createElement("option");
    option.value = subject;
    option.textContent = subject;
    els.subjectSelect.append(option);
  });
}

function startQuiz(questions, mode) {
  if (questions.length === 0) {
    showMessage("目前沒有可練習的題目。", true);
    return;
  }

  state.currentQuestions = questions;
  state.answers = Array.from({ length: questions.length }, () => "");
  state.currentIndex = 0;
  state.mode = mode;
  els.quizTitle.textContent = mode === "wrong" ? "錯題練習" : "隨機練習";
  showMessage("");
  showView("quiz");
  renderQuestion();
}

function startRandomQuiz() {
  const subject = els.subjectSelect.value;
  const pool = subject === "__all__" ? state.allQuestions : state.allQuestions.filter((item) => item.subject === subject);

  if (pool.length < QUESTION_COUNT) {
    showMessage(`「${els.subjectSelect.selectedOptions[0].textContent}」目前只有 ${pool.length} 題，至少需要 ${QUESTION_COUNT} 題才能開始。`, true);
    return;
  }

  const selected = shuffle(pool).slice(0, QUESTION_COUNT);
  startQuiz(selected, "random");
}

function startWrongQuiz() {
  const wrongIds = new Set(getWrongIds());
  const pool = state.allQuestions.filter((item) => wrongIds.has(item.id));
  const selected = shuffle(pool).slice(0, QUESTION_COUNT);
  startQuiz(selected, "wrong");
}

function renderQuestion() {
  const question = state.currentQuestions[state.currentIndex];
  const total = state.currentQuestions.length;

  els.progressText.textContent = `第 ${state.currentIndex + 1} / ${total} 題`;
  els.subjectBadge.textContent = question.subject;
  els.questionText.textContent = question.question;
  els.options.innerHTML = "";

  Object.entries(question.options).forEach(([key, value]) => {
    const label = document.createElement("label");
    label.className = "option";

    const input = document.createElement("input");
    input.type = "radio";
    input.name = "answer";
    input.value = key;
    input.checked = state.answers[state.currentIndex] === key;
    input.addEventListener("change", () => {
      state.answers[state.currentIndex] = key;
    });

    const text = document.createElement("span");
    text.textContent = `${key}. ${value}`;

    label.append(input, text);
    els.options.append(label);
  });

  els.prevQuestion.disabled = state.currentIndex === 0;
  els.nextQuestion.disabled = state.currentIndex === total - 1;
}

function gradeQuiz() {
  const wrongIds = new Set(getWrongIds());
  let correctCount = 0;
  els.reviewList.innerHTML = "";

  state.currentQuestions.forEach((question, index) => {
    const selected = state.answers[index];
    const isCorrect = selected === question.answer;

    if (isCorrect) {
      correctCount += 1;
      wrongIds.delete(question.id);
    } else {
      wrongIds.add(question.id);
    }

    const item = document.createElement("article");
    item.className = `review-item ${isCorrect ? "correct" : "wrong"}`;

    const title = document.createElement("h3");
    title.textContent = `${index + 1}. ${question.question}`;

    const userAnswer = document.createElement("p");
    userAnswer.className = "answer-line";
    userAnswer.textContent = `你的答案：${selected ? `${selected}. ${question.options[selected]}` : "未作答"}`;

    const rightAnswer = document.createElement("p");
    rightAnswer.className = "answer-line";
    rightAnswer.textContent = `正確答案：${question.answer}. ${question.options[question.answer]}`;

    const explanation = document.createElement("p");
    explanation.textContent = `解析：${question.explanation}`;

    item.append(title, userAnswer, rightAnswer, explanation);
    els.reviewList.append(item);
  });

  setWrongIds([...wrongIds]);

  const rate = Math.round((correctCount / state.currentQuestions.length) * 100);
  els.scoreRate.textContent = `${rate}%`;
  els.scoreDetail.textContent = `答對 ${correctCount} / ${state.currentQuestions.length} 題`;
  showView("result");
}

function goHome() {
  showView("setup");
  updateWrongCount();
}

async function init() {
  try {
    state.allQuestions = await loadQuestions();
    populateSubjects();
    updateWrongCount();
    showView("setup");
  } catch (error) {
    showMessage(`${error.message}。請用本機伺服器開啟，不要直接雙擊 HTML。`, true);
  }
}

els.startRandom.addEventListener("click", startRandomQuiz);
els.startWrong.addEventListener("click", startWrongQuiz);
els.backHome.addEventListener("click", goHome);
els.prevQuestion.addEventListener("click", () => {
  state.currentIndex -= 1;
  renderQuestion();
});
els.nextQuestion.addEventListener("click", () => {
  state.currentIndex += 1;
  renderQuestion();
});
els.submitQuiz.addEventListener("click", gradeQuiz);
els.retrySame.addEventListener("click", () => {
  startQuiz(state.currentQuestions, state.mode);
});
els.resultHome.addEventListener("click", goHome);

init();
