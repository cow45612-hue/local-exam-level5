# Pronunciation recordings

Original OGG recordings are from Wikimedia Commons. `sources.json` records each
file's author, source page, license, original checksum, and MP3 checksum.
See each linked source page for the full attribution and licensing details.

MP3 files are format conversions of the corresponding OGG files using FFmpeg;
no speech was synthesized. Playback speed is changed only in the browser.
Converted recordings retain the source license. The vocabulary screen displays
the author, source link, and license link for the current recording.

The filenames identify US pronunciation, but recordings have not all been
individually reviewed for pronunciation or word-sense suitability.

Resume collection from the project root with:

```powershell
python scripts/download_human_audio.py
```

The collector honors HTTP 429 Retry-After and stops on repeated failures.
It does not overwrite existing study vocabulary or synthetic audio files.
`pending.json` lists vocabulary items not yet installed.
