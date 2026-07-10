import json
import re
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import urlretrieve

import pdfplumber
from pypdf import PdfReader

BASE_URL = "https://wwwq.moex.gov.tw/exam/wHandExamQandA_File.ashx"
CACHE_DIR = Path("tmp-moex-115")
QUESTION_FILE = Path("questions.json")

SUBJECTS = [
    {"key": "chinese", "name": "\u570b\u6587", "code": "0101", "max_question": 35},
    {"key": "civic_english", "name": "\u516c\u6c11\u8207\u82f1\u6587", "code": "0102", "max_question": 50},
    {"key": "law", "name": "\u6cd5\u5b78\u5927\u610f", "code": "0202", "max_question": 50},
    {"key": "admin", "name": "\u884c\u653f\u5b78\u5927\u610f", "code": "0301", "max_question": 50},
]

OPTION_MARKS = {
    "\ue18c": "A",
    "\ue18d": "B",
    "\ue18e": "C",
    "\ue18f": "D",
}


def download(subject):
    CACHE_DIR.mkdir(exist_ok=True)
    paths = {}
    for file_type, suffix in [("Q", "q"), ("S", "a")]:
        query = urlencode({
            "t": file_type,
            "code": "115010",
            "c": "501",
            "s": subject["code"],
            "q": "1",
        })
        path = CACHE_DIR / f"{subject['key']}-{suffix}.pdf"
        if not path.exists():
            urlretrieve(f"{BASE_URL}?{query}", path)
        paths[suffix] = path
    return paths


def extract_text(path):
    return "\n".join(page.extract_text() or "" for page in PdfReader(path).pages)


def clean_line(line):
    line = line.strip()
    if not line:
        return ""
    ignored_prefixes = (
        "115",
        "\u7b49 \u5225",
        "\u985e \u79d1",
        "\u79d1 \u76ee",
        "\u8003\u8a66\u6642\u9593",
        "\u203b\u6ce8\u610f",
        "\u4ee3\u865f",
        "\u9801\u6b21",
        "\u4e00\u3001",
        "\u8aaa\u660e",
    )
    if line.startswith(ignored_prefixes):
        return ""
    return line


def question_blocks(text, max_question):
    lines = [clean_line(line) for line in text.splitlines()]
    blocks = []
    expected = 1
    current = []

    for line in lines:
        if not line:
            continue
        match = re.match(rf"^{expected}\s+(.+)", line)
        if match:
            if current:
                blocks.append("\n".join(current))
            current = [match.group(1)]
            expected += 1
            if expected > max_question + 1:
                break
        elif current:
            current.append(line)

    if current and len(blocks) < max_question:
        blocks.append("\n".join(current))
    return blocks[:max_question]


def split_options(block):
    positions = [(block.find(mark), mark) for mark in OPTION_MARKS if block.find(mark) >= 0]
    positions.sort()
    if len(positions) != 4:
        return None

    question = block[:positions[0][0]].strip()
    options = {}
    for idx, (start, mark) in enumerate(positions):
        end = positions[idx + 1][0] if idx + 1 < len(positions) else len(block)
        options[OPTION_MARKS[mark]] = block[start + 1:end].strip()
    if not question or any(not options.get(key) for key in "ABCD"):
        return None
    return question, options


def answer_map(path, max_question):
    answers = {}
    with pdfplumber.open(path) as pdf:
        for table in pdf.pages[0].extract_tables():
            if len(table) < 2:
                continue
            numbers = table[0]
            values = table[1]
            for number_cell, answer_cell in zip(numbers, values):
                if not number_cell or not answer_cell:
                    continue
                match = re.search(r"\u7b2c(\d+)\u984c", number_cell)
                answer = answer_cell.strip().replace("\n", "")
                if match and re.fullmatch(r"[A-D]", answer):
                    number = int(match.group(1))
                    if number <= max_question:
                        answers[number] = answer
    return answers


def build_115_questions():
    questions = []
    for subject in SUBJECTS:
        paths = download(subject)
        text = extract_text(paths["q"])
        blocks = question_blocks(text, subject["max_question"])
        answers = answer_map(paths["a"], subject["max_question"])

        for idx, block in enumerate(blocks, start=1):
            parsed = split_options(block)
            answer = answers.get(idx)
            if not parsed or not answer:
                continue
            question, options = parsed
            questions.append({
                "id": f"general-administration-115-initial-{subject['key']}-{idx}",
                "source": "\u8003\u9078\u90e8\u8003\u7562\u8a66\u984c\u67e5\u8a62\u5e73\u81fa",
                "year": 115,
                "exam": "\u516c\u52d9\u4eba\u54e1\u521d\u7b49\u8003\u8a66",
                "category": "\u4e00\u822c\u884c\u653f",
                "subject": f"{subject['name']}\uff08115 \u521d\u7b49\u8003\u8a66\uff09",
                "question": question,
                "A": options["A"],
                "B": options["B"],
                "C": options["C"],
                "D": options["D"],
                "answer": answer,
                "explanation": f"\u5b98\u65b9\u7b54\u6848\uff1a{answer}\u3002\u4f86\u6e90\uff1a\u8003\u9078\u90e8 115 \u5e74\u516c\u52d9\u4eba\u54e1\u521d\u7b49\u8003\u8a66\u8003\u7562\u8a66\u984c\u3002",
            })
        print(f"115 {subject['name']}: {len([q for q in questions if q['subject'].startswith(subject['name'])])}")
    return questions


def main():
    existing = json.loads(QUESTION_FILE.read_text(encoding="utf-8"))
    without_115 = [item for item in existing if item.get("year") != 115]
    merged = without_115 + build_115_questions()
    QUESTION_FILE.write_text(json.dumps(merged, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"wrote {len(merged)} total questions")


if __name__ == "__main__":
    main()
