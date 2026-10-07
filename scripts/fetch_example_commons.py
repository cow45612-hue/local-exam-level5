"""Resume example audio collection using exact US Wikimedia human recordings."""
import argparse
import hashlib
import json
import re
import subprocess
import time
from urllib.parse import urlencode, urlsplit, urlunsplit

import download_human_audio as commons
import fetch_example_audio as examples


def exact_recording(word, title, metadata):
    pattern = r'^File:En-(us-)?' + re.escape(word) + r'(?:[2-9]|-[12])?\.(?:ogg|oga|wav)$'
    match = re.fullmatch(pattern, title, re.IGNORECASE)
    if not match:
        return False
    details = ' '.join(commons.plain(metadata.get(key, {}).get('value', ''))
                       for key in ('Categories', 'ImageDescription')).lower()
    if any(text in details for text in ('text-to-speech', 'synthetic', 'computer-generated')):
        return False
    return bool(match[1]) or any(text in details for text in
                                ('u.s. english pronunciation', 'united states english', 'general american'))


def query(parameters):
    return json.loads(commons.fetch(commons.API + '?' + urlencode({
        'action': 'query', 'format': 'json', 'formatversion': 2,
        'prop': 'imageinfo', 'iiprop': 'url|extmetadata', **parameters})))


def main():
    cli = argparse.ArgumentParser(description=__doc__)
    cli.add_argument('--limit', type=int, default=0)
    args = cli.parse_args()
    vocabulary = json.loads((examples.ROOT / 'tsmc-vocabulary.json').read_text(encoding='utf-8'))
    tokens = examples.clicked_tokens(vocabulary)
    primary = {r['word'].lower() for r in json.loads(
        (examples.ROOT / 'audio-human/sources.json').read_text(encoding='utf-8'))}
    records = {r['word']: r for r in json.loads(
        (examples.OUT / 'sources.json').read_text(encoding='utf-8'))}
    missing = sorted(tokens - primary - records.keys())
    if args.limit:
        missing = missing[:args.limit]
    catalog_path = examples.OUT / 'commons-catalog.json'
    catalog = json.loads(catalog_path.read_text(encoding='utf-8')) if catalog_path.exists() else {}
    for index, word in enumerate(missing):
        if word not in catalog:
            titles = ['File:En-' + prefix + word + suffix + extension
                      for prefix in ('us-', '') for suffix in ('', '2')
                      for extension in ('.ogg', '.wav')]
            data = query({'titles': '|'.join(titles)})
            pages = data.get('query', {}).get('pages', [])
            if not any(p.get('imageinfo') for p in pages):
                search = query({'generator': 'search', 'gsrnamespace': 6, 'gsrlimit': 10,
                                'gsrsearch': 'intitle:"En-us-' + word + '"'})
                pages += search.get('query', {}).get('pages', [])
            catalog[word] = pages
            commons.atomic_json(catalog_path, catalog)
        installed = False
        for page in catalog[word]:
            info = page.get('imageinfo', [])
            if not info:
                continue
            source = info[0]
            meta = source.get('extmetadata', {})
            if not exact_recording(word, page['title'], meta):
                continue
            license_name = commons.plain(meta.get('LicenseShortName', {}).get('value', ''))
            artist = commons.recording_artist(meta)
            if license_name not in commons.ALLOWED or not artist:
                continue
            parsed = urlsplit(source['url'])
            if parsed.scheme != 'https' or parsed.hostname != 'upload.wikimedia.org':
                continue
            url = urlunsplit((parsed.scheme, parsed.netloc, parsed.path, '', ''))
            try:
                raw = commons.fetch(url)
                extension = parsed.path.rsplit('.', 1)[-1].lower()
                filename = re.sub(r'[^a-z0-9-]', '_', word)
                original = examples.OUT / (filename + '.' + extension)
                original.write_bytes(raw)
                file = examples.OUT / (filename + '.mp3')
                subprocess.run(['ffmpeg', '-y', '-v', 'error', '-i', str(original),
                                '-codec:a', 'libmp3lame', '-q:a', '2', str(file)], check=True)
                duration = examples.validate(file)
                if not 0.1 <= duration <= 15:
                    raise ValueError('Unexpected recording duration')
                records[word] = {'word': word, 'filename': file.name,
                    'page': source['descriptionurl'], 'audioUrl': url, 'accent': 'US',
                    'artist': artist, 'license': license_name,
                    'licenseUrl': meta.get('LicenseUrl', {}).get('value', ''),
                    'originalFilename': original.name,
                    'originalSha256': hashlib.sha256(raw).hexdigest(),
                    'sha256': hashlib.sha256(file.read_bytes()).hexdigest(), 'duration': duration,
                    'verification': 'Exact US word source and metadata checked; full audio decode passed; not individually listened'}
                examples.save(records, tokens, primary)
                installed = True
                print('OK', word, flush=True)
                break
            except Exception as error:
                examples.save(records, tokens, primary)
                print('FAILED_AUDIO', word, str(error), flush=True)
                if getattr(error, 'code', None) in (401, 403):
                    raise
        if not installed:
            print('NO_EXACT_RECORDING', word, flush=True)
        print('PROGRESS', index + 1, '/', len(missing), flush=True)
        time.sleep(1)
    examples.save(records, tokens, primary)


if __name__ == '__main__':
    main()
