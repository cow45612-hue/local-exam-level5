"""Build explicitly labelled practice tracks from US human word recordings."""
import argparse
import hashlib
import json
import subprocess
import tempfile
from pathlib import Path

import download_human_audio as collector

PHRASES = {
    11: ['air', 'shower'], 44: ['clean', 'chamber'],
    74: ['emergency', 'stop'], 82: ['e', 'u', 'v', 'extreme', 'ultraviolet'],
    140: ['log', 'sheet'], 155: ['miss', 'operation'],
    223: ['run', 'card'], 224: ['s', 'o', 'p'],
    254: ['super', 'hot', 'run'], 260: ['take', 'leave'],
    267: ['thin', 'film'], 275: ['turn', 'rate'],
}


def phrase_metadata(word, parts, digest, duration):
    if not parts or any(p.get('accent') != 'US' for p in parts):
        raise ValueError('Every phrase segment must be a US human recording')
    spoken = ' / '.join(p['word'].upper() if len(p['word']) == 1 else p['word'] for p in parts)
    if word['id'] == 155:
        spoken = 'mis- / operation'
    return {
        'id': word['id'], 'word': word['word'], 'accent': 'US',
        'recordingType': 'segmented_human',
        'segmentWords': [p['word'] for p in parts], 'segments': [dict(p) for p in parts],
        'spokenText': spoken, 'artist': 'US human word recordings',
        'page': parts[0]['page'], 'audioUrl': '',
        'license': 'See individual segment sources', 'licenseUrl': parts[0]['page'],
        'sha256': digest, 'duration': duration,
        'pronunciationReview': 'Human word/prefix practice with pauses; not a naturally spoken phrase',
    }


def build(parts, destination):
    with tempfile.TemporaryDirectory(prefix='human-phrase-') as temp:
        folder = Path(temp)
        files = []
        silence = folder / 'pause.wav'
        subprocess.run(['ffmpeg', '-y', '-v', 'error', '-f', 'lavfi', '-i',
                        'anullsrc=r=48000:cl=mono', '-t', '0.12', str(silence)], check=True)
        for index, part in enumerate(parts):
            source = Path(part['file'])
            if hashlib.sha256(source.read_bytes()).hexdigest() != part['sha256']:
                raise ValueError('Segment hash mismatch: ' + part['word'])
            wav = folder / f'{index}.wav'
            subprocess.run(['ffmpeg', '-y', '-v', 'error', '-xerror', '-i', str(source),
                            '-ar', '48000', '-ac', '1', '-af',
                            'silenceremove=start_periods=1:start_duration=0.02:start_threshold=-45dB,areverse,silenceremove=start_periods=1:start_duration=0.02:start_threshold=-45dB,areverse',
                            str(wav)], check=True)
            if files:
                files.append(silence)
            files.append(wav)
        concat = folder / 'parts.txt'
        concat.write_text(''.join("file '" + p.as_posix() + "'\n" for p in files), encoding='utf-8')
        subprocess.run(['ffmpeg', '-y', '-v', 'error', '-f', 'concat', '-safe', '0',
                        '-i', str(concat), '-c:a', 'libmp3lame', '-q:a', '2', str(destination)], check=True)
    subprocess.run(['ffmpeg', '-v', 'error', '-xerror', '-i', str(destination), '-f', 'null', '-'], check=True)
    duration = float(subprocess.check_output(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', str(destination)], text=True))
    if not 0.15 < duration < 20:
        raise ValueError('Unexpected phrase duration')
    return hashlib.sha256(destination.read_bytes()).hexdigest(), duration


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('parts', type=Path)
    args = parser.parse_args()
    extras = json.loads(args.parts.read_text(encoding='utf-8'))
    records = json.loads((collector.OUT / 'sources.json').read_text(encoding='utf-8'))
    vocabulary = {w['id']: w for w in json.loads((collector.ROOT / 'tsmc-vocabulary.json').read_text(encoding='utf-8'))}
    existing = {r['word'].lower(): dict(r, file=str(collector.OUT / f"{r['id']}.mp3")) for r in records}
    lookup = existing | extras
    ready = []
    for word_id, names in PHRASES.items():
        missing = [name for name in names if name not in lookup]
        if missing:
            raise ValueError(f'Missing {word_id} segments: {missing}')
        parts = [lookup[name] for name in names]
        phrase_metadata(vocabulary[word_id], parts, '', 0)
        ready.append((word_id, parts))
    for word_id, parts in ready:
        target = collector.OUT / f'{word_id}.mp3'
        digest, duration = build(parts, target)
        record = phrase_metadata(vocabulary[word_id], parts, digest, duration)
        # Never expose machine-specific paths in the published attribution.
        for part in record['segments']:
            part.pop('file', None)
        records = [r for r in records if r['id'] != word_id] + [record]
        print('OK', word_id, record['spokenText'], flush=True)
    records.sort(key=lambda r: r['id'])
    collector.save(records, [])
    collector.update_page_version(records)
    print(f'AVAILABLE {len(records)}/{len(vocabulary)}; segmented phrases {len(ready)}')


if __name__ == '__main__':
    main()
