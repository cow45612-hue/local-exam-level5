"""Download verified Cambridge US recordings into a separate staging directory.

Run: python scripts/download_cambridge_audio.py --limit 1
Existing site audio is never replaced by this downloader. HTTP access blocks stop
the run; no alternate proxy, credentials, or synthesized fallback is used.
"""

import argparse
import hashlib
import json
from pathlib import Path
from urllib.parse import quote, urljoin, urlparse

import requests
from bs4 import BeautifulSoup

ROOT = Path(__file__).resolve().parent.parent
OUTPUT = ROOT / "audio-cambridge"
MANIFEST = OUTPUT / "manifest.json"
BASE = "https://dictionary.cambridge.org"


def save_manifest(records):
    temporary = MANIFEST.with_suffix(".tmp")
    temporary.write_text(json.dumps(records, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    temporary.replace(MANIFEST)


def extract_recording(html, expected_word, page_url):
    soup = BeautifulSoup(html, "html.parser")
    # Only accept the requested headword and the US pronunciation section.
    for section in soup.select(".pronunciation, .pr.entry-body__el, .entry-body__el"):
        headword = section.select_one(".headword, .hw.dhw, .hw")
        if not headword or headword.get_text(" ", strip=True).casefold() != expected_word.casefold():
            continue
        for us in section.select(".us"):
            source = us.select_one('source[type="audio/mpeg"]')
            if source and source.get("src"):
                audio_url = urljoin(page_url, source["src"])
                if urlparse(audio_url).hostname != "dictionary.cambridge.org":
                    continue
                ipa = us.select_one(".ipa")
                return audio_url, ipa.get_text(strip=True) if ipa else None
    return None


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--limit", type=int, default=288)
    args = parser.parse_args()
    OUTPUT.mkdir(exist_ok=True)
    vocabulary = json.loads((ROOT / "tsmc-vocabulary.json").read_text(encoding="utf-8"))
    old = json.loads(MANIFEST.read_text(encoding="utf-8")) if MANIFEST.exists() else []
    by_id = {record["id"]: record for record in old}
    records = []
    for item in vocabulary:
        word = item["word"]
        records.append(by_id.get(item["id"], {
            "id": item["id"], "word": word, "status": "pending",
            "pageUrl": f"{BASE}/pronunciation/english/{quote(word.lower().replace(' ', '-'), safe='-')}",
        }))
    save_manifest(records)
    session = requests.Session()
    attempted = 0
    for record in records:
        target = OUTPUT / f'{record["id"]}.mp3'
        if record["status"] == "downloaded" and target.exists():
            if hashlib.sha256(target.read_bytes()).hexdigest() == record.get("sha256"):
                continue
        if attempted >= args.limit:
            break
        attempted += 1
        try:
            page = session.get(record["pageUrl"], timeout=30)
            if page.status_code in (401, 403, 429):
                record["status"] = "access_blocked"
                record["httpStatus"] = page.status_code
                save_manifest(records)
                print(f'STOP: Cambridge blocked access ({page.status_code}), word={record["word"]}', flush=True)
                return 2
            page.raise_for_status()
            match = extract_recording(page.text, record["word"], page.url)
            if not match:
                record["status"] = "review_needed"
                record["reason"] = "No verified matching US headword recording found"
            else:
                audio_url, ipa = match
                response = session.get(audio_url, timeout=30)
                if response.status_code in (401, 403, 429):
                    record["status"] = "access_blocked"
                    save_manifest(records)
                    print(f'STOP: audio access blocked ({response.status_code})', flush=True)
                    return 2
                response.raise_for_status()
                data = response.content
                if "audio" not in response.headers.get("Content-Type", "") or len(data) < 1000:
                    raise ValueError("Response is not a usable audio recording")
                target.write_bytes(data)
                record.update(status="downloaded", audioUrl=audio_url, ipa=ipa,
                              sha256=hashlib.sha256(data).hexdigest())
        except (requests.RequestException, ValueError) as error:
            record.update(status="review_needed", reason=str(error))
        save_manifest(records)
        print(f'{record["word"]}: {record["status"]}', flush=True)
    print(f'Downloaded: {sum(r["status"] == "downloaded" for r in records)}/{len(records)}')
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
