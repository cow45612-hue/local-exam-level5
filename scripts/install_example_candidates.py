"""Install exact US recordings whose dictionary/speaker labels were inspected."""
import hashlib
import json
import re
from urllib.parse import urlparse, parse_qs, unquote

import fetch_example_audio as examples


def verified_candidate(record):
    url = urlparse(record['audioUrl'])
    page = urlparse(record['page'])
    normalize = lambda text: re.sub('[^a-z0-9]', '', text.lower())
    if page.hostname == 'forvo.com':
        return (page.scheme == 'https' and page.path.startswith('/word/')
                and normalize(unquote(page.path[6:]).strip('/')) == normalize(record['word'])
                and normalize(record['word']) == normalize(record['spokenText'])
                and record.get('speakerLocation') == 'United States'
                and record.get('language') == 'English' and record.get('artist')
                and str(record.get('recordingId', '')).isdigit()
                and url.scheme == 'https' and re.fullmatch(r'audio\d+\.forvo\.com', url.hostname or '')
                and url.path.startswith(('/audios/mp3/', '/mp3/')) and url.path.endswith('.mp3'))
    link = urlparse(record['observedLink'])
    query = parse_qs(link.query)
    return (normalize(record['word']) == normalize(record['spokenText'])
            and url.scheme == 'https' and url.hostname == 'media.merriam-webster.com'
            and url.path.startswith('/audio/prons/en/us/mp3/')
            and page.scheme == 'https' and page.hostname == 'www.merriam-webster.com'
            and link.hostname == page.hostname and link.path == page.path
            and query.get('lang') == ['en_us']
            and url.path.endswith('/' + query.get('file', [''])[0] + '.mp3'))


def main():
    records = {r['word']: r for r in json.loads((examples.OUT / 'sources.json').read_text(encoding='utf-8'))}
    tokens = examples.clicked_tokens(json.loads((examples.ROOT / 'tsmc-vocabulary.json').read_text(encoding='utf-8')))
    primary = {r['word'].lower() for r in json.loads((examples.ROOT / 'audio-human/sources.json').read_text(encoding='utf-8'))}
    candidates = json.loads((examples.OUT / 'merriam-candidates.json').read_text(encoding='utf-8'))
    forvo_file = examples.OUT / 'forvo-candidates.json'
    if forvo_file.exists():
        forvo = json.loads(forvo_file.read_text(encoding='utf-8'))
        candidates += [r | {'spokenText': r.get('spokenText', r['word']),
            'page': r.get('page', 'https://forvo.com/word/' + r['word'] + '/'),
            'speakerLocation': forvo['speakerLocation'], 'language': forvo['language']}
            for r in forvo['recordings']]
    for record in candidates:
        word = record['word']
        if word in records:
            continue
        if word not in tokens or not verified_candidate(record):
            raise ValueError('Candidate has no verified exact US source: ' + word)
        raw, actual = examples.fetch(record['audioUrl'])
        if urlparse(actual).hostname != urlparse(record['audioUrl']).hostname:
            raise ValueError('Unexpected redirected audio host')
        file = examples.OUT / (word + '.mp3')
        file.write_bytes(raw)
        duration = examples.validate(file)
        if not 0.1 <= duration <= 15:
            raise ValueError('Unexpected duration')
        records[word] = record | {'filename': file.name, 'accent': 'US',
            'artist': record.get('artist', 'Merriam-Webster Dictionary'), 'sha256': hashlib.sha256(raw).hexdigest(),
            'duration': duration,
            'verification': 'Headword and US pronunciation link checked in browser; full MP3 decode passed; not individually listened'}
        examples.save(records, tokens, primary)
        print('OK', word, flush=True)


if __name__ == '__main__':
    main()
