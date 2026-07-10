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
and skips questions that already have teacherExplanation.
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


SYSTEM_PROMPT = """你是台灣公職初等考試補習班老師。
你的任務是替單選題產生「真的教得懂」的解析，不是改答案。

規則：
1. 必須以題目提供的 answer 為標準答案，不得自行更改正解。
2. 語氣要像補習班老師白話講解，具體、可操作、不要空泛。
3. 不可以寫「不是官方答案」「官方答案是 X」這種廢話。
4. thinkingSteps 必須針對本題，包含題幹和選項中的具體詞，不要寫通用流程。
5. optionAnalysis 的 A/B/C/D 都要填。正確選項說明它為何正確；錯誤選項說明：
   - 這個選項在說什麼
   - 為什麼沒有回答到題幹
   - 容易誤選的原因
6. 如果你不確定某個專有名詞，請保守說明並在 reviewFlags 加上原因。
7. 回傳只能是符合 JSON Schema 的 JSON，不要 Markdown。
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
        "請替下面這題產生老師版解析。不要更改 answer。\n"
        "解析要讓考生看完知道：題目在考什麼、怎麼判斷、每個選項錯在哪、下次怎麼抓關鍵字。\n\n"
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

    for field in REQUIRED_FIELDS:
        if field not in enrichment:
            flags.append(f"missing_{field}")

    if enrichment.get("explanationQuality") != "ai_generated":
        flags.append("bad_explanationQuality")

    steps = enrichment.get("thinkingSteps")
    if not isinstance(steps, list) or len(steps) < 3:
        flags.append("thinkingSteps_too_short")

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
            if "不是官方答案" in text or "官方答案" in text:
                flags.append(f"option_{key}_official_answer_phrase")

    correct_reason = str(enrichment.get("correctReason", ""))
    if answer and answer not in correct_reason:
        flags.append("correctReason_missing_answer_letter")
    if "官方答案" in correct_reason:
        flags.append("correctReason_official_answer_phrase")

    return flags


def merge_enrichment(question: dict[str, Any], enrichment: dict[str, Any]) -> dict[str, Any]:
    merged = dict(question)
    teacher_explanation = {field: enrichment[field] for field in REQUIRED_FIELDS}
    merged["teacherExplanation"] = teacher_explanation

    # Also copy to top-level fields because the current web app reads these names directly.
    for field in REQUIRED_FIELDS:
        merged[field] = enrichment[field]

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
        if question.get("teacherExplanation"):
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
