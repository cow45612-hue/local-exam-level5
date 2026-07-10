#!/usr/bin/env python3
"""
Enrich questions.json with AI-generated teacher-style explanations.

Usage:
  $env:OPENAI_API_KEY="sk-..."
  python scripts/enrich_questions.py --limit 20

The script never modifies questions.json. It writes:
  - questions.enriched.json
  - review_needed.json

It is resumable: if questions.enriched.json exists, the script loads that file
and skips questions that already have teacherExplanation. Use --force to discard
old teacherExplanation values and regenerate them.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_INPUT = ROOT / "questions.json"
DEFAULT_OUTPUT = ROOT / "questions.enriched.json"
DEFAULT_REVIEW = ROOT / "review_needed.json"
OPENAI_URL = "https://api.openai.com/v1/chat/completions"

REQUIRED_FIELDS = [
    "topic",
    "subTopic",
    "keyPoint",
    "thinkingSteps",
    "correctReason",
    "optionAnalysis",
    "memoryTip",
    "keywords",
    "explanationQuality",
]


SCHEMA: dict[str, Any] = {
    "type": "object",
    "properties": {
        "topic": {"type": "string"},
        "subTopic": {"type": "string"},
        "keyPoint": {"type": "string"},
        "thinkingSteps": {
            "type": "array",
            "minItems": 3,
            "maxItems": 5,
            "items": {"type": "string"},
        },
        "correctReason": {"type": "string"},
        "optionAnalysis": {
            "type": "object",
            "properties": {
                "A": {"type": "string"},
                "B": {"type": "string"},
                "C": {"type": "string"},
                "D": {"type": "string"},
            },
            "required": ["A", "B", "C", "D"],
            "additionalProperties": False,
        },
        "memoryTip": {"type": "string"},
        "keywords": {
            "type": "array",
            "minItems": 2,
            "maxItems": 5,
            "items": {"type": "string"},
        },
        "explanationQuality": {"type": "string", "enum": ["ai_generated"]},
        "reviewFlags": {
            "type": "array",
            "items": {"type": "string"},
        },
    },
    "required": REQUIRED_FIELDS + ["reviewFlags"],
    "additionalProperties": False,
}


SYSTEM_PROMPT = """你是台灣公職初等考試補習班老師，但要用「學生聽得懂」的口語講法。
你的任務是替單選題產生真正能教會人的解析，不是改答案。

總原則：
1. 必須以題目提供的 answer 為標準答案，不得自行更改正解。
2. 講法要像老師坐在旁邊直接講給考生聽，可以白話、可以提醒陷阱，但不要裝學術。
3. 每一句都要有用。禁止空話，例如：
   - 先看題幹問什麼
   - 抓關鍵字
   - 排除不符合的選項
   - 不是官方答案
   - 這個選項沒有回答題幹
   除非你後面立刻說出「本題的哪個字、哪個選項、哪個概念」。
4. thinkingSteps 必須是本題專屬，至少兩步要直接引用題目或選項的原字。
5. correctReason 要用這種口吻：
   「這題其實在問……。D 這句話的重點是……，剛好對到……，所以選 D。」
6. optionAnalysis 的 A/B/C/D 都要填。
   - 正確選項：說它為什麼正確。
   - 錯誤選項：不要只說錯。要說：
     這個選項在講什麼、它哪裡和題目不合、為什麼考生容易被騙。
7. memoryTip 要短、好記、像考前提醒。
8. keywords 要列出考生下次真的要圈起來看的 2 到 5 個詞。
9. 如果題目資料不足，請誠實保守說明，並在 reviewFlags 加上原因。
10. 回傳只能是符合 JSON Schema 的 JSON，不要 Markdown。

好的語氣示範：
「A 看起來很像，因為它也提到政策過程；但題目問的是行政學對政策的基本描述，不是政策網絡裡誰和誰互動，所以 A 偏題。」

不好的語氣示範：
「A 不是官方答案。」
"""


def load_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def write_json_atomic(path: Path, data: Any) -> None:
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    tmp.replace(path)


def question_options(question: dict[str, Any]) -> dict[str, str]:
    options = question.get("options") or {}
    return {
        "A": str(options.get("A") or question.get("A") or ""),
        "B": str(options.get("B") or question.get("B") or ""),
        "C": str(options.get("C") or question.get("C") or ""),
        "D": str(options.get("D") or question.get("D") or ""),
    }


def compact_question(question: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": question.get("id"),
        "year": question.get("year"),
        "exam": question.get("exam"),
        "category": question.get("category"),
        "subject": question.get("subject"),
        "question": question.get("question"),
        "options": question_options(question),
        "answer": question.get("answer"),
        "existingExplanation": question.get("explanation", ""),
    }


def build_user_prompt(question: dict[str, Any]) -> str:
    return (
        "請替下面這題重新產生老師版解析。不要更改 answer。\n"
        "目標：考生看完要真的懂，不要只是知道答案。\n"
        "請特別注意：thinkingSteps 和 optionAnalysis 不能寫通用模板，必須引用本題選項裡的具體文字。\n\n"
        + json.dumps(compact_question(question), ensure_ascii=False, indent=2)
    )


def call_openai(question: dict[str, Any], model: str, api_key: str, timeout: int) -> dict[str, Any]:
    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": build_user_prompt(question)},
        ],
        "temperature": 0.2,
        "response_format": {
            "type": "json_schema",
            "json_schema": {
                "name": "teacher_explanation",
                "strict": True,
                "schema": SCHEMA,
            },
        },
    }
    body = json.dumps(payload).encode("utf-8")
    request = urllib.request.Request(
        OPENAI_URL,
        data=body,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )

    with urllib.request.urlopen(request, timeout=timeout) as response:
        data = json.loads(response.read().decode("utf-8"))

    content = data["choices"][0]["message"]["content"]
    return json.loads(content)


def validate_enrichment(question: dict[str, Any], enrichment: dict[str, Any]) -> list[str]:
    flags: list[str] = []
    answer = str(question.get("answer") or "").upper()
    options = question_options(question)
    option_fragments = [value[:8] for value in options.values() if value]
    banned_phrases = [
        "不是官方答案",
        "官方答案",
        "先看題幹問什麼",
        "抓關鍵字",
        "排除不符合",
        "沒有回答題幹",
    ]

    for field in REQUIRED_FIELDS:
        if field not in enrichment:
            flags.append(f"missing_{field}")

    if enrichment.get("explanationQuality") != "ai_generated":
        flags.append("bad_explanationQuality")

    steps = enrichment.get("thinkingSteps")
    if not isinstance(steps, list) or len(steps) < 3:
        flags.append("thinkingSteps_too_short")
    elif sum(1 for step in steps if any(fragment and fragment in step for fragment in option_fragments)) < 2:
        flags.append("thinkingSteps_not_specific_enough")

    keywords = enrichment.get("keywords")
    if not isinstance(keywords, list) or not 2 <= len(keywords) <= 5:
        flags.append("keywords_count")

    option_analysis = enrichment.get("optionAnalysis")
    if not isinstance(option_analysis, dict):
        flags.append("optionAnalysis_not_object")
    else:
        for key in ["A", "B", "C", "D"]:
            text = str(option_analysis.get(key, "")).strip()
            if len(text) < 20:
                flags.append(f"option_{key}_too_short")
            if any(phrase in text for phrase in banned_phrases):
                flags.append(f"option_{key}_official_answer_phrase")

    correct_reason = str(enrichment.get("correctReason", ""))
    if len(correct_reason) < 50:
        flags.append("correctReason_too_short")
    if answer and answer not in correct_reason:
        flags.append("correctReason_missing_answer_letter")
    if any(phrase in correct_reason for phrase in banned_phrases):
        flags.append("correctReason_bad_phrase")

    return flags


def merge_enrichment(question: dict[str, Any], enrichment: dict[str, Any]) -> dict[str, Any]:
    merged = dict(question)
    teacher_explanation = {field: enrichment[field] for field in REQUIRED_FIELDS}
    merged["teacherExplanation"] = teacher_explanation

    # Also copy to top-level fields because the current web app reads these names directly.
    for field in REQUIRED_FIELDS:
        merged[field] = enrichment[field]
    merged["plainExplanation"] = enrichment["correctReason"]

    return merged


def load_base_questions(input_path: Path, output_path: Path) -> list[dict[str, Any]]:
    if output_path.exists():
        print(f"Resuming from {output_path}")
        return load_json(output_path)
    return load_json(input_path)


def load_review(path: Path) -> list[dict[str, Any]]:
    if path.exists():
        return load_json(path)
    return []


def upsert_review(review: list[dict[str, Any]], entry: dict[str, Any]) -> None:
    qid = entry.get("id")
    review[:] = [item for item in review if item.get("id") != qid]
    review.append(entry)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Generate teacher-style explanations for questions.json")
    parser.add_argument("--input", type=Path, default=DEFAULT_INPUT)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--review", type=Path, default=DEFAULT_REVIEW)
    parser.add_argument("--model", default=os.environ.get("OPENAI_MODEL", "gpt-4o-mini"))
    parser.add_argument("--limit", type=int, default=10, help="Maximum number of questions to enrich this run")
    parser.add_argument("--sleep", type=float, default=0.4, help="Seconds to sleep between API calls")
    parser.add_argument("--timeout", type=int, default=90)
    parser.add_argument("--force", action="store_true", help="Regenerate even if teacherExplanation already exists")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        print("Missing OPENAI_API_KEY. Set it first, for example: $env:OPENAI_API_KEY='sk-...'", file=sys.stderr)
        return 2

    questions = load_base_questions(args.input, args.output)
    review = load_review(args.review)
    processed = 0

    for index, question in enumerate(questions):
        if processed >= args.limit:
            break
        if question.get("teacherExplanation") and not args.force:
            continue

        qid = question.get("id", f"index-{index}")
        print(f"[{processed + 1}/{args.limit}] enriching {qid}")
        try:
            enrichment = call_openai(question, args.model, api_key, args.timeout)
            flags = validate_enrichment(question, enrichment)
            questions[index] = merge_enrichment(question, enrichment)

            if flags or enrichment.get("reviewFlags"):
                upsert_review(
                    review,
                    {
                        "id": qid,
                        "index": index,
                        "subject": question.get("subject"),
                        "answer": question.get("answer"),
                        "flags": flags + list(enrichment.get("reviewFlags", [])),
                    },
                )

            write_json_atomic(args.output, questions)
            write_json_atomic(args.review, review)
            processed += 1
            time.sleep(args.sleep)
        except (urllib.error.HTTPError, urllib.error.URLError, TimeoutError, json.JSONDecodeError, KeyError, ValueError) as exc:
            upsert_review(
                review,
                {
                    "id": qid,
                    "index": index,
                    "subject": question.get("subject"),
                    "answer": question.get("answer"),
                    "flags": ["api_or_parse_error"],
                    "error": str(exc),
                },
            )
            write_json_atomic(args.output, questions)
            write_json_atomic(args.review, review)
            print(f"Stopped at {qid}: {exc}", file=sys.stderr)
            return 1

    write_json_atomic(args.output, questions)
    write_json_atomic(args.review, review)
    remaining = sum(1 for question in questions if not question.get("teacherExplanation"))
    print(f"Done. Enriched this run: {processed}. Remaining: {remaining}.")
    print(f"Wrote {args.output}")
    print(f"Wrote {args.review}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
