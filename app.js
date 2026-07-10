const QUESTION_COUNT = 20;
const WRONG_KEY = "initial-exam-wrong-question-ids";
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

function showMessage(text) {
  els.loadMessage.textContent = text;
  els.loadMessage.hidden = !text;
}

function switchView(view) {
  els.setupView.hidden = view !== "setup";
  els.quizView.hidden = view !== "quiz";
  els.resultView.hidden = view !== "result";
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

  els.options.innerHTML = "";
  Object.entries(question.options).forEach(([key, text]) => {
    const label = document.createElement("label");
    label.className = "option";
    label.dataset.option = key;

    const input = document.createElement("input");
    input.type = "radio";
    input.name = "answer";
    input.value = key;

    const optionKey = document.createElement("span");
    optionKey.className = "option-key";
    optionKey.textContent = key;

    const optionText = document.createElement("span");
    optionText.textContent = text;

    label.append(input, optionKey, optionText);
    label.addEventListener("click", () => chooseAnswer(key));
    els.options.appendChild(label);
  });
}

function chooseAnswer(answer) {
  if (state.results[state.currentIndex] !== null) return;

  const question = state.currentQuestions[state.currentIndex];
  const isCorrect = answer === question.answer;
  const wrongIds = getWrongIds();

  state.answers[state.currentIndex] = answer;
  state.results[state.currentIndex] = isCorrect;

  if (isCorrect) {
    const found = wrongIds.indexOf(question.id);
    if (found >= 0) wrongIds.splice(found, 1);
  } else {
    wrongIds.push(question.id);
  }

  setWrongIds(wrongIds);
  renderFeedback(question, answer, isCorrect);
}

function renderFeedback(question, answer, isCorrect) {
  els.options.querySelectorAll(".option").forEach((option) => {
    const key = option.dataset.option;
    option.classList.toggle("selected", key === answer);
    option.classList.toggle("correct-answer", key === question.answer);
    option.classList.toggle("wrong-answer", key === answer && !isCorrect);
    option.querySelector("input").checked = key === answer;
  });

  els.feedbackCard.hidden = false;
  els.feedbackCard.classList.add(isCorrect ? "correct" : "wrong");
  els.feedbackTitle.textContent = isCorrect ? "答對了" : "答錯了";
  els.feedbackAnswer.textContent = `正確答案：${question.answer}`;
  els.feedbackExplanation.textContent = question.explanation;
  els.continueQuiz.disabled = false;
  els.continueQuiz.textContent = state.currentIndex === state.currentQuestions.length - 1 ? "看本次成績" : "下一題";
  els.progressFill.style.width = `${((state.currentIndex + 1) / state.currentQuestions.length) * 100}%`;
}

function finishQuiz() {
  const correct = state.results.filter(Boolean).length;
  renderResult(correct);
  switchView("result");
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
    const card = document.createElement("article");
    card.className = `review-item ${isCorrect ? "correct" : "wrong"}`;
    card.innerHTML = `
      <p class="badge">${question.subject}</p>
      <h3>${index + 1}. ${question.question}</h3>
      <p>你的答案：<strong>${userAnswer}</strong></p>
      <p>正確答案：<strong>${question.answer}</strong></p>
      <p class="explanation">${question.explanation}</p>
    `;
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
    updateWrongCount();
    els.questionCountStat.textContent = questions.length;
    showMessage(`題庫已載入：${questions.length} 題`);
  })
  .catch((error) => {
    showMessage(error.message);
    els.startRandom.disabled = true;
    els.startWrong.disabled = true;
  });
