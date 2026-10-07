"""Collect openly licensed US pronunciation recordings from Wikimedia Commons."""
import hashlib
import argparse
import html
import json
import re
import subprocess
import time
from email.utils import parsedate_to_datetime
from pathlib import Path
from urllib.parse import urlencode, urlsplit, urlunsplit
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "audio-human"
API = "https://commons.wikimedia.org/w/api.php"
ALLOWED = {"CC BY-SA 3.0", "CC BY-SA 4.0", "CC0", "Public domain"}


def original_path(record):
    extension = record.get("originalExtension", "ogg")
    if extension not in {"ogg", "oga", "wav", "flac"}:
        raise ValueError("Unexpected original audio extension")
    return OUT / (str(record["id"]) + "." + extension)


def candidate_accent(candidate):
    details = candidate.get("details", "").lower()
    filename = candidate.get("file", "").lower()
    if any(text in details for text in ("a=us", "a=ga", "texas", "new jersey", "california")) or filename.startswith("en-us-"):
        return "US"
    if "canada" in details or filename.startswith("en-ca-"):
        return "CA"
    if any(text in details for text in ("a=au", "brisbane", "australia")) or filename.startswith("en-au-"):
        return "AU"
    if any(text in details for text in ("england", "london", "a=uk", "a=ssb", "a=rp")) or filename.startswith("en-uk-"):
        return "UK"
    return "EN"


def select_candidate(word, candidates):
    candidates = [c for c in candidates if not c.get("status", "").startswith("reject_") and candidate_accent(c) == "US"]
    markers = {"noun": ("-noun", "(noun)"), "verb": ("-verb", "(verb)"), "adjective": ("-adj", "(adjective)")}
    all_markers = tuple(marker for values in markers.values() for marker in values)
    expected = markers.get(word.get("type"), ())
    def score(candidate):
        filename = candidate["file"].lower()
        def has_marker(marker):
            return re.search(re.escape(marker) + r"(?=[ ._-]|$)", filename) is not None
        if word["id"] == 218 and "reset2" in filename:
            return 100
        if word["id"] == 246 and "standby2" in filename:
            return 100
        if any(has_marker(marker) for marker in all_markers) and not any(has_marker(marker) for marker in expected):
            return 100
        return {"US": 0, "CA": 1, "UK": 2, "AU": 3, "EN": 4}[candidate_accent(candidate)]
    candidates = [candidate for candidate in candidates if score(candidate) < 100]
    return min(candidates, key=score) if candidates else None


def atomic_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    temporary.replace(path)


def retry_seconds(value, now=None):
    now = time.time() if now is None else now
    try:
        return max(1, int(value))
    except (TypeError, ValueError):
        try:
            return max(1, int(parsedate_to_datetime(value).timestamp() - now))
        except (TypeError, ValueError, OverflowError):
            return 60


def fetch(url):
    request = Request(url, headers={"User-Agent": "LocalExamVocabulary/1.1 (https://github.com/cow45612-hue/local-exam-level5; educational pronunciation collection)"})
    state_path = OUT / "download-state.json"
    state = json.loads(state_path.read_text(encoding="utf-8")) if state_path.exists() else {}
    host = urlsplit(url).netloc
    wait = max(0, state.get(host, 0) - time.time())
    if wait:
        print("Resuming cooldown; waiting", round(wait), "seconds", flush=True)
        time.sleep(wait)
    temporary_failures = 0
    while True:
        try:
            with urlopen(request, timeout=45) as response:
                data = response.read()
            state.pop(host, None)
            atomic_json(state_path, state)
            return data
        except HTTPError as error:
            if error.code == 429:
                delay = retry_seconds(error.headers.get("Retry-After"))
                state[host] = time.time() + delay
                atomic_json(state_path, state)
                print("Rate limited; automatically waiting", delay, "seconds before retry", flush=True)
                time.sleep(delay)
                continue
            if error.code not in {500, 502, 503, 504}:
                raise
            temporary_failures += 1
            if temporary_failures >= 5:
                raise
            time.sleep(max(2 ** temporary_failures, retry_seconds(error.headers.get("Retry-After", "1"))))
        except (URLError, TimeoutError, ConnectionError):
            temporary_failures += 1
            if temporary_failures >= 5:
                raise
            print("Temporary network failure; retry", temporary_failures, flush=True)
            time.sleep(min(60, 2 ** temporary_failures))


def plain(value):
    return html.unescape(re.sub(r"<[^>]+>", "", value)).strip()


def recording_artist(meta):
    artist = plain(meta.get("Artist", {}).get("value", ""))
    if artist:
        return artist
    description = plain(meta.get("ImageDescription", {}).get("value", ""))
    match = re.search(r"recorded by\s+([A-Za-z0-9_ -]{1,80})\s*$", description, re.IGNORECASE)
    return match[1].strip() if match else ""


def update_page_version(records):
    index = ROOT / "index.html"
    content = index.read_text(encoding="utf-8")
    digest = hashlib.sha256(json.dumps(records, sort_keys=True).encode()).hexdigest()[:12]
    pattern = r'(<script src="\./audio-human/recordings\.js\?v=)[^"]+("[^>]*></script>)'
    updated, count = re.subn(pattern, lambda match: match[1] + "human-" + digest + match[2], content)
    if count != 1:
        raise ValueError("Expected exactly one human recordings script in index.html")
    if updated != content:
        index.write_text(updated, encoding="utf-8")


def save(records, pending):
    words = json.loads((ROOT / "tsmc-vocabulary.json").read_text(encoding="utf-8"))
    completed = {r["id"] for r in records}
    reasons = {r["id"]: r for r in pending}
    pending = [reasons.get(w["id"], {"id": w["id"], "word": w["word"], "reason": "not_downloaded"})
               for w in words if w["id"] not in completed]
    atomic_json(OUT / "sources.json", records)
    atomic_json(OUT / "pending.json", pending)
    mapping = {r["word"].lower(): {
        "file": "./audio-human/" + str(r["id"]) + ".mp3?v=" + r["sha256"][:12],
        "artist": r["artist"], "page": r["page"],
        "license": r["license"], "licenseUrl": r["licenseUrl"],
        "accent": r.get("accent", "EN"), "spokenText": r.get("spokenText", r["word"]),
    } for r in records}
    temporary = OUT / "recordings.js.tmp"
    temporary.write_text("window.HUMAN_RECORDINGS = " + json.dumps(mapping, ensure_ascii=False, indent=2) + ";\n", encoding="utf-8")
    temporary.replace(OUT / "recordings.js")


def main(refresh_only=False):
    OUT.mkdir(exist_ok=True)
    words = json.loads((ROOT / "tsmc-vocabulary.json").read_text(encoding="utf-8"))
    sources = OUT / "sources.json"
    records = json.loads(sources.read_text(encoding="utf-8")) if sources.exists() else []
    pending_file = OUT / "pending.json"
    pending = json.loads(pending_file.read_text(encoding="utf-8")) if pending_file.exists() else []
    catalog_file = OUT / "catalog.json"
    catalog = json.loads(catalog_file.read_text(encoding="utf-8")) if catalog_file.exists() else {}
    metadata = {info["descriptionurl"]: info["extmetadata"]
                for pages in catalog.values() for page in pages for info in page.get("imageinfo", [])}
    for record in records:
        if not record.get("artist"):
            record["artist"] = recording_artist(metadata.get(record["page"], {}))
            record["artistSource"] = "source_description"
    existing = {r["id"]: r for r in records}
    if refresh_only:
        save(records, pending)
        update_page_version(records)
        return
    for start in range(0, len(words), 40):
        batch = words[start:start + 40]
        titles = "|".join("File:En-us-" + w["word"].lower() + ".ogg" for w in batch)
        query = urlencode({"action": "query", "format": "json", "prop": "imageinfo", "iiprop": "url|extmetadata", "titles": titles})
        if titles not in catalog:
            catalog[titles] = list(json.loads(fetch(API + "?" + query))["query"]["pages"].values())
            atomic_json(catalog_file, catalog)
        pages = catalog[titles]
        by_title = {p["title"].lower().replace("_", " "): p for p in pages}
        for word in batch:
            target = OUT / (str(word["id"]) + ".mp3")
            prior = existing.get(word["id"])
            original = original_path(prior or {"id": word["id"]})
            if prior and target.exists() and original.exists() and hashlib.sha256(target.read_bytes()).hexdigest() == prior["sha256"] and hashlib.sha256(original.read_bytes()).hexdigest() == prior["originalSha256"]:
                continue
            title = "File:En-us-" + word["word"].lower() + ".ogg"
            page = by_title.get(title.lower().replace("_", " "), {})
            info = page.get("imageinfo", [])
            if not info:
                pending = [p for p in pending if p["id"] != word["id"]] + [{"id": word["id"], "word": word["word"], "reason": "filename_not_found"}]
                continue
            data = info[0]
            meta = data["extmetadata"]
            license_name = plain(meta.get("LicenseShortName", {}).get("value", ""))
            artist = recording_artist(meta)
            if license_name not in ALLOWED or not artist:
                pending.append({"id": word["id"], "word": word["word"], "reason": "license_or_attribution_review"})
                continue
            try:
                parts = urlsplit(data["url"])
                audio_url = urlunsplit((parts.scheme, parts.netloc, parts.path, "", ""))
                if parts.scheme != "https" or parts.netloc != "upload.wikimedia.org":
                    raise ValueError("Unexpected audio host")
                raw = fetch(audio_url)
                if not raw.startswith(b"OggS"):
                    raise ValueError("Invalid OGG recording")
                original.write_bytes(raw)
                # MP3 keeps playback compatible with older iPhone browsers.
                subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", str(original), "-codec:a", "libmp3lame", "-q:a", "2", str(target)], check=True)
                duration = float(subprocess.check_output(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", str(target)], text=True).strip())
                if not 0.15 <= duration <= 30:
                    raise ValueError("Unexpected duration")
                record = {"id": word["id"], "word": word["word"], "accent": "US",
                          "artist": artist,
                          "license": license_name, "licenseUrl": meta.get("LicenseUrl", {}).get("value", ""),
                          "page": data["descriptionurl"], "audioUrl": audio_url,
                          "originalSha256": hashlib.sha256(raw).hexdigest(),
                          "sha256": hashlib.sha256(target.read_bytes()).hexdigest(), "duration": duration}
                records = [r for r in records if r["id"] != word["id"]] + [record]
                pending = [p for p in pending if p["id"] != word["id"]]
                save(records, pending)
                print("OK", word["id"], word["word"], flush=True)
                time.sleep(5)
            except Exception as error:
                pending.append({"id": word["id"], "word": word["word"], "reason": str(error)})
                save(records, pending)
                print("FAILED", word["word"], str(error), flush=True)
                if getattr(error, "code", None) in {401, 403}:
                    raise
        save(records, pending)
    remaining = json.loads(pending_file.read_text(encoding="utf-8"))
    update_page_version(records)
    print("DONE", len(records), "recordings;", len(remaining), "pending", flush=True)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--refresh-only", action="store_true", help="Refresh manifests and website cache key without downloading")
    main(parser.parse_args().refresh_only)
