import fs from "node:fs/promises";

const API = "https://api.lawplayer.com/api/v1/exam/questions";
const profession = "general-administration";
const initialExamYears = [114, 113, 112, 111, 110, 109];
const subjects = [
  { slug: "chinese", label: "\u570b\u6587" },
  { slug: "\u516c\u6c11\u8207\u82f1\u6587", label: "\u516c\u6c11\u8207\u82f1\u6587" },
  { slug: "jurisprudence-basics", label: "\u6cd5\u5b78\u5927\u610f" },
  { slug: "\u884c\u653f\u5b78\u5927\u610f", label: "\u884c\u653f\u5b78\u5927\u610f" },
];

function getRows(payload) {
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.data?.items)) return payload.data.items;
  if (Array.isArray(payload?.items)) return payload.items;
  return [];
}

function optionMap(options = []) {
  const map = {};
  for (const option of options) {
    map[option.label] = option.text;
  }
  return map;
}

async function fetchQuestions(year, subject) {
  const url = new URL(API);
  url.searchParams.set("profession", profession);
  url.searchParams.set("year", String(year));
  url.searchParams.set("subject", subject.slug);
  url.searchParams.set("limit", "200");

  const response = await fetch(url);
  if (!response.ok) {
    console.warn(`skip ${year} ${subject.label}: ${response.status} ${response.statusText}`);
    return [];
  }

  return getRows(await response.json());
}

function toAppQuestion(item) {
  const options = optionMap(item.options);
  const answers = Array.isArray(item.acceptedAnswers) && item.acceptedAnswers.length
    ? item.acceptedAnswers
    : [item.correctAnswer].filter(Boolean);

  return {
    id: item.questionId,
    source: "\u8003\u9078\u90e8\u6b77\u5c46\u8a66\u984c / LawPlayer \u7d50\u69cb\u5316\u6574\u7406",
    year: item.year,
    exam: "\u516c\u52d9\u4eba\u54e1\u521d\u7b49\u8003\u8a66",
    category: item.profession,
    subject: `${item.subject}\uff08${item.year} \u521d\u7b49\u8003\u8a66\uff09`,
    question: item.content.replace(/\n\([A-D]\).*/gs, "").trim(),
    A: options.A ?? "",
    B: options.B ?? "",
    C: options.C ?? "",
    D: options.D ?? "",
    answer: answers[0] ?? "",
    explanation: `\u5b98\u65b9\u7b54\u6848\uff1a${answers.join("\u3001")}\u3002\u4f86\u6e90\uff1a\u8003\u9078\u90e8\u6b77\u5c46\u8a66\u984c\uff0cLawPlayer \u7d50\u69cb\u5316\u6574\u7406\u3002`,
  };
}

function hasUnsupportedOption(item) {
  const text = [item.question, item.A, item.B, item.C, item.D, item.explanation]
    .map((value) => String(value ?? ""))
    .join(" ");
  return text.includes("\ue190") || text.includes("複選題");
}

const all = [];
for (const year of initialExamYears) {
  for (const subject of subjects) {
    const rows = await fetchQuestions(year, subject);
    const initialRows = rows.filter((item) => item.questionId?.includes("-\u521d\u7b49-"));
    const singleChoiceRows = initialRows.filter((item) => {
      const answers = Array.isArray(item.acceptedAnswers) && item.acceptedAnswers.length
        ? item.acceptedAnswers
        : [item.correctAnswer].filter(Boolean);
      return answers.length === 1 && /^[A-D]$/.test(answers[0]);
    });
    all.push(...singleChoiceRows.map(toAppQuestion));
    console.log(`${year} ${subject.label}: ${singleChoiceRows.length}`);
  }
}

const seen = new Set();
const clean = all.filter((item) => {
  if (seen.has(item.id)) return false;
  seen.add(item.id);
  return item.question && item.A && item.B && item.C && item.D && /^[A-D]$/.test(item.answer) && !hasUnsupportedOption(item);
});

await fs.writeFile("questions.json", `${JSON.stringify(clean, null, 2)}\n`, "utf8");
console.log(`wrote ${clean.length} LawPlayer questions`);
