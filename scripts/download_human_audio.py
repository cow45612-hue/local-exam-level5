"""Collect openly licensed US pronunciation recordings from Wikimedia Commons."""
import hashlib
import html
import json
import re
import subprocess
import time
from pathlib import Path
from urllib.parse import urlencode, urlsplit, urlunsplit
from urllib.request import Request, urlopen
from urllib.error import HTTPError

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "audio-human"
API = "https://commons.wikimedia.org/w/api.php"
ALLOWED = {"CC BY-SA 3.0", "CC BY-SA 4.0", "CC0", "Public domain"}


def fetch(url):
    request = Request(url, headers={"User-Agent": "LocalExamVocabulary/1.0 (educational pronunciation collection)"})
    for attempt in range(3):
        try:
            with urlopen(request, timeout=45) as response:
                return response.read()
        except HTTPError as error:
            if error.code != 429 or attempt == 2:
                raise
            delay = max(60, int(error.headers.get("Retry-After", "60")))
            print("Rate limited; waiting", delay, "seconds", flush=True)
            time.sleep(delay)


def plain(value):
    return html.unescape(re.sub(r"<[^>]+>", "", value)).strip()


def save(records, pending):
    words = json.loads((ROOT / "tsmc-vocabulary.json").read_text(encoding="utf-8"))
    completed = {r["id"] for r in records}
    reasons = {r["id"]: r for r in pending}
    pending = [reasons.get(w["id"], {"id": w["id"], "word": w["word"], "reason": "not_downloaded"})
               for w in words if w["id"] not in completed]
    (OUT / "sources.json").write_text(json.dumps(records, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (OUT / "pending.json").write_text(json.dumps(pending, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    mapping = {r["word"].lower(): {
        "file": "./audio-human/" + str(r["id"]) + ".mp3?v=" + r["sha256"][:12],
        "artist": r["artist"], "page": r["page"],
        "license": r["license"], "licenseUrl": r["licenseUrl"],
    } for r in records}
    (OUT / "recordings.js").write_text("window.HUMAN_RECORDINGS = " + json.dumps(mapping, ensure_ascii=False, indent=2) + ";\n", encoding="utf-8")


def main():
    OUT.mkdir(exist_ok=True)
    words = json.loads((ROOT / "tsmc-vocabulary.json").read_text(encoding="utf-8"))
    sources = OUT / "sources.json"
    records = json.loads(sources.read_text(encoding="utf-8")) if sources.exists() else []
    existing = {r["id"]: r for r in records}
    pending = []
    for start in range(0, len(words), 40):
        batch = words[start:start + 40]
        titles = "|".join("File:En-us-" + w["word"].lower() + ".ogg" for w in batch)
        query = urlencode({"action": "query", "format": "json", "prop": "imageinfo", "iiprop": "url|extmetadata", "titles": titles})
        pages = json.loads(fetch(API + "?" + query))["query"]["pages"].values()
        by_title = {p["title"].lower().replace("_", " "): p for p in pages}
        for word in batch:
            target = OUT / (str(word["id"]) + ".mp3")
            prior = existing.get(word["id"])
            if prior and target.exists() and hashlib.sha256(target.read_bytes()).hexdigest() == prior["sha256"]:
                continue
            title = "File:En-us-" + word["word"].lower() + ".ogg"
            page = by_title.get(title.lower().replace("_", " "), {})
            info = page.get("imageinfo", [])
            if not info:
                pending.append({"id": word["id"], "word": word["word"], "reason": "filename_not_found"})
                continue
            data = info[0]
            meta = data["extmetadata"]
            license_name = plain(meta.get("LicenseShortName", {}).get("value", ""))
            if license_name not in ALLOWED:
                pending.append({"id": word["id"], "word": word["word"], "reason": "license_review"})
                continue
            try:
                parts = urlsplit(data["url"])
                audio_url = urlunsplit((parts.scheme, parts.netloc, parts.path, "", ""))
                if parts.scheme != "https" or parts.netloc != "upload.wikimedia.org":
                    raise ValueError("Unexpected audio host")
                raw = fetch(audio_url)
                if not raw.startswith(b"OggS"):
                    raise ValueError("Invalid OGG recording")
                original = OUT / (str(word["id"]) + ".ogg")
                original.write_bytes(raw)
                # MP3 keeps playback compatible with older iPhone browsers.
                subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", str(original), "-codec:a", "libmp3lame", "-q:a", "2", str(target)], check=True)
                duration = float(subprocess.check_output(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", str(target)], text=True).strip())
                if not 0.15 <= duration <= 30:
                    raise ValueError("Unexpected duration")
                record = {"id": word["id"], "word": word["word"], "accent": "US",
                          "artist": plain(meta.get("Artist", {}).get("value", "")),
                          "license": license_name, "licenseUrl": meta.get("LicenseUrl", {}).get("value", ""),
                          "page": data["descriptionurl"], "audioUrl": audio_url,
                          "originalSha256": hashlib.sha256(raw).hexdigest(),
                          "sha256": hashlib.sha256(target.read_bytes()).hexdigest(), "duration": duration}
                records = [r for r in records if r["id"] != word["id"]] + [record]
                save(records, pending)
                print("OK", word["id"], word["word"], flush=True)
                time.sleep(5)
            except Exception as error:
                pending.append({"id": word["id"], "word": word["word"], "reason": str(error)})
                save(records, pending)
                print("FAILED", word["word"], str(error), flush=True)
                if getattr(error, "code", None) in {401, 403, 429}:
                    raise
        save(records, pending)
    print("DONE", len(records), "recordings;", len(pending), "pending", flush=True)


if __name__ == "__main__":
    main()
