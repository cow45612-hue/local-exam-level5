# Pronunciation recordings

Original OGG, OGA and WAV recordings are from Wikimedia Commons. `sources.json` records each
file's author, source page, license, original checksum, and MP3 checksum.
See each linked source page for the full attribution and licensing details.

MP3 files are format conversions of the corresponding original files using FFmpeg;
no speech was synthesized. Playback speed is changed only in the browser.
Converted recordings retain the source license. The vocabulary screen displays
the author, source link, and license link for the current recording.

Only US English recordings are installed. UK, Australian and Canadian candidates
may remain in the research inventory but are not used by the player or published.
Candidate entries and noun/verb distinctions are checked against source metadata,
but recordings have not all been individually listened to for pronunciation.
`spokenText` identifies recordings of a normalized spelling or expanded term;
the original study vocabulary and its localStorage identifiers are unchanged.

Resume collection from the project root with:

```powershell
python scripts/download_human_audio.py
```

The collector automatically waits for HTTP 429 Retry-After and then retries the
same file. Cooldown deadlines are saved locally and honored after a restart.
Metadata batches are cached; already verified OGG/MP3 pairs are skipped.
Temporary network/server errors are retried up to five times. HTTP 401/403
still stops collection rather than bypassing access restrictions.
It does not overwrite existing study vocabulary or synthetic audio files.
`pending.json` lists vocabulary items not yet installed.

## Additional Recordings

`research-candidates.json` lists exact-word candidates and other sources requiring
additional review. A source page or longer phrase is not an installed recording.
Rejected word mismatches are preserved in the research list.

```powershell
python scripts/import_human_audio_candidates.py
```

The importer accepts only US recordings and preserves each original
file's extension and checksum. It resumes verified downloads and can replace a
recording when the selected candidate changes. No AI voice is used to fill gaps.

An automatic GitHub Actions workflow is prepared locally but is not part of the
published audio update. The site still uses the existing main/root Pages deployment.
