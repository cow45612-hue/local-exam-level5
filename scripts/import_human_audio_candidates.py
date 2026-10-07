"""Install reviewed word/POS candidates without changing learning vocabulary."""
import hashlib
import json
import subprocess
import time
from pathlib import Path
from urllib.parse import urlencode, urlsplit, urlunsplit, unquote
import download_human_audio as collector


def main():
    report = json.loads((collector.OUT / "research-candidates.json").read_text(encoding="utf-8"))
    vocabulary = {w["id"]: w for w in json.loads((collector.ROOT / "tsmc-vocabulary.json").read_text(encoding="utf-8"))}
    records = json.loads((collector.OUT / "sources.json").read_text(encoding="utf-8"))
    pending = json.loads((collector.OUT / "pending.json").read_text(encoding="utf-8"))
    selected = [(vocabulary[w["id"]], collector.select_candidate(vocabulary[w["id"]], w["candidates"])) for w in report["words"]]
    selected = [(word, candidate) for word, candidate in selected if candidate]
    metadata = {}
    for start in range(0, len(selected), 30):
        batch = selected[start:start + 30]
        query = urlencode({"action": "query", "format": "json", "prop": "imageinfo", "iiprop": "url|extmetadata", "titles": "|".join("File:" + c["file"] for _, c in batch)})
        pages = json.loads(collector.fetch(collector.API + "?" + query))["query"]["pages"].values()
        metadata.update({page["title"].lower().replace("_", " "): page for page in pages})
        time.sleep(2)
    for word, candidate in selected:
        prior = next((r for r in records if r["id"] == word["id"]), None)
        target = collector.OUT / (str(word["id"]) + ".mp3")
        prior_filename = unquote(urlsplit(prior["audioUrl"]).path).rsplit("/", 1)[-1] if prior else ""
        same_candidate = prior_filename.lower().replace("_", " ") == candidate["file"].lower().replace("_", " ")
        if prior and same_candidate and target.exists() and collector.original_path(prior).exists():
            if hashlib.sha256(target.read_bytes()).hexdigest() == prior["sha256"] and hashlib.sha256(collector.original_path(prior).read_bytes()).hexdigest() == prior["originalSha256"]:
                continue
        page = metadata.get(("File:" + candidate["file"]).lower().replace("_", " "), {})
        info = page.get("imageinfo", [])
        if not info:
            print("MISSING", word["word"], flush=True)
            continue
        data = info[0]
        meta = data["extmetadata"]
        artist = collector.recording_artist(meta)
        if "Speaker:" in artist:
            artist = artist.split("Speaker:", 1)[1].split("Recorder:", 1)[0].strip()
        # This file's PD-self statement and upload history identify Muke.
        if not artist and word["id"] == 150 and candidate["file"].lower() == "en-us-measure.ogg":
            artist = "Muke"
        if not artist:
            print("AUTHOR REVIEW", word["word"], flush=True)
            continue
        parts = urlsplit(data["url"])
        if parts.scheme != "https" or parts.netloc != "upload.wikimedia.org":
            raise ValueError("Unexpected audio host")
        audio_url = urlunsplit((parts.scheme, parts.netloc, parts.path, "", ""))
        extension = Path(candidate["file"]).suffix.lower().lstrip(".")
        record = {"id": word["id"], "word": word["word"], "originalExtension": extension}
        original = collector.original_path(record)
        raw = collector.fetch(audio_url)
        valid = (extension in {"ogg", "oga"} and raw.startswith(b"OggS")) or (extension == "wav" and raw.startswith(b"RIFF") and raw[8:12] == b"WAVE") or (extension == "flac" and raw.startswith(b"fLaC"))
        if not valid:
            raise ValueError("Invalid original audio: " + candidate["file"])
        original.write_bytes(raw)
        subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", str(original), "-codec:a", "libmp3lame", "-q:a", "2", str(target)], check=True)
        duration = float(subprocess.check_output(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", str(target)], text=True).strip())
        if not 0.15 <= duration <= 15:
            raise ValueError("Unexpected word audio duration")
        record.update({"accent": collector.candidate_accent(candidate), "artist": artist,
                       "license": collector.plain(meta.get("LicenseShortName", {}).get("value", "Not specified")),
                       "licenseUrl": meta.get("LicenseUrl", {}).get("value", ""),
                       "page": data["descriptionurl"], "audioUrl": audio_url,
                       "spokenText": candidate.get("entry", "overtime" if word["id"] == 172 else word["word"]),
                       "originalSha256": hashlib.sha256(raw).hexdigest(),
                       "sha256": hashlib.sha256(target.read_bytes()).hexdigest(), "duration": duration,
                       "pronunciationReview": "word_and_pos_source_checked_not_individually_listened"})
        records = [r for r in records if r["id"] != word["id"]] + [record]
        pending = [p for p in pending if p["id"] != word["id"]]
        collector.save(records, pending)
        collector.update_page_version(records)
        print("OK", word["id"], word["word"], record["accent"], artist, flush=True)
        time.sleep(5)
    print("DONE", len(records), "recordings;", 288 - len(records), "pending", flush=True)


if __name__ == "__main__":
    main()
