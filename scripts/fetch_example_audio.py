"""Collect exact US human dictionary recordings for clickable example words."""
import argparse
import hashlib
import json
import re
import shutil
import subprocess
import tempfile
import time
import urllib.error
import urllib.parse
import urllib.request
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'audio-example'
HOST = 'www.oxfordlearnersdictionaries.com'


def clicked_tokens(words):
    return {token.lower() for word in words for field in ('fabPhrase', 'exampleSentence')
            for token in re.findall(r"[a-zA-Z0-9'-]+", word.get(field, ''))}


def exact_audio(word, sources, headwords=()):
    normalized = re.sub(r'[^a-z0-9]', '', word.lower())
    for source in sources:
        parsed = urllib.parse.urlparse(source)
        if parsed.scheme != 'https' or parsed.hostname != HOST or '/us_pron/' not in parsed.path:
            continue
        name = urllib.parse.unquote(Path(parsed.path).name)
        prefix = re.split(r'_+(?:\d+_)?us_', name)[0]
        recorded = re.sub(r'[^a-z0-9]', '', prefix.lower())
        if recorded == normalized or (recorded == 'x' + normalized and word.lower() in headwords):
            return source
    return None


class AudioParser(HTMLParser):
    def __init__(self, page):
        super().__init__()
        self.page = page
        self.sources = []
        self.headwords = set()
        self.headword_text = None
    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == 'h1' and 'headword' in attrs.get('class', '').split():
            self.headword_text = ''
        source = attrs.get('data-src-mp3', '')
        if source:
            self.sources.append(urllib.parse.urljoin(self.page, source))

    def handle_data(self, data):
        if self.headword_text is not None:
            self.headword_text += data

    def handle_endtag(self, tag):
        if tag == 'h1' and self.headword_text is not None:
            self.headwords.add(re.sub(r'\d+$', '', self.headword_text.strip()).lower())
            self.headword_text = None


def entry_candidates(word):
    irregular = {'is':'be', 'are':'be', 'becomes':'become', 'has':'have', 'held':'hold',
                 'spun':'spin', 'comes':'come', 'taking':'take', 'highest':'high',
                 'according':'accord', 'barcodes':'barcode', 'cassettes':'cassette'}
    result = [word, irregular.get(word, word)]
    if word.endswith('ies'):
        result.append(word[:-3] + 'y')
    if word.endswith('s'):
        result.append(word[:-1])
    if word.endswith('es'):
        result.append(word[:-2])
    for suffix in ('ing', 'ed'):
        if word.endswith(suffix):
            stem = word[:-len(suffix)]
            result.extend([stem + 'e', stem])
            if len(stem) > 2 and stem[-1] == stem[-2]:
                result.append(stem[:-1])
    base = list(dict.fromkeys(result))
    return base + [entry + suffix for entry in base for suffix in ('_1', '_2')]


def fetch(url):
    request = urllib.request.Request(url, headers={'User-Agent':'Mozilla/5.0'})
    with urllib.request.urlopen(request, timeout=15) as response:
        return response.read(), response.url


def validate(file):
    subprocess.run(['ffmpeg', '-v', 'error', '-xerror', '-i', str(file), '-f', 'null', '-'],
                   check=True, capture_output=True)
    return float(subprocess.check_output(['ffprobe', '-v', 'error', '-show_entries',
                  'format=duration', '-of', 'default=nw=1:nk=1', str(file)], text=True))


def save(records, tokens, primary):
    ordered = [records[key] for key in sorted(records)]
    (OUT / 'sources.json').write_text(json.dumps(ordered, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
    mapping = {key: {'file':'./audio-example/'+r['filename']+'?v='+r['sha256'][:12],
                    'page':r['page'], 'accent':'US', 'artist':r['artist'],
                    'license':r.get('license', ''), 'licenseUrl':r.get('licenseUrl', '')} for key,r in records.items()}
    (OUT / 'recordings.js').write_text('window.EXAMPLE_RECORDINGS = '+json.dumps(mapping, ensure_ascii=False, indent=2)+';\n', encoding='utf-8')
    missing = sorted(tokens - primary - records.keys())
    (OUT / 'coverage.json').write_text(json.dumps({'tokenCount':len(tokens),
        'availableCount':len(tokens)-len(missing), 'exampleRecordingCount':len(records),
        'missing':missing}, indent=2)+'\n', encoding='utf-8')


def main():
    cli = argparse.ArgumentParser(description=__doc__)
    cli.add_argument('--limit', type=int, default=0, help='Maximum missing tokens to check; 0 checks all')
    args = cli.parse_args()
    OUT.mkdir(exist_ok=True)
    vocabulary = json.loads((ROOT / 'tsmc-vocabulary.json').read_text(encoding='utf-8'))
    tokens = clicked_tokens(vocabulary)
    primary = {r['word'].lower() for r in json.loads((ROOT / 'audio-human/sources.json').read_text(encoding='utf-8'))}
    path = OUT / 'sources.json'
    records = {r['word']:r for r in json.loads(path.read_text(encoding='utf-8'))} if path.exists() else {}
    parts_file = Path(tempfile.gettempdir()) / 'phrase-us-parts/sources.json'
    if parts_file.exists():
        parts = json.loads(parts_file.read_text(encoding='utf-8'))
        for word, part in parts.items():
            if word not in tokens or word in primary or word in records:
                continue
            local = Path(part['file'])
            if hashlib.sha256(local.read_bytes()).hexdigest() != part['sha256']:
                raise ValueError('Saved part hash mismatch')
            shutil.copyfile(local, OUT / (word+'.mp3'))
            records[word] = {k:v for k,v in part.items() if k != 'file'} | {'filename':word+'.mp3'}
    save(records, tokens, primary)
    cache = {}
    missing = sorted(tokens - primary - records.keys())
    # Put the reported broken sentence first, then retain deterministic progress.
    missing.sort(key=lambda word: (word not in {'make','sure','the','is','in','a','an','of','to','and'}, word))
    if args.limit:
        missing = missing[:args.limit]
    for index, word in enumerate(missing):
        audio = None
        page = ''
        entries = [(family, entry) for family in ('american_english', 'english')
                   for entry in entry_candidates(word)]
        for family, entry in entries:
            page = 'https://'+HOST+'/definition/'+family+'/'+urllib.parse.quote(entry)
            if page not in cache:
                try:
                    raw, actual_page = fetch(page)
                    parser = AudioParser(actual_page)
                    parser.feed(raw.decode('utf-8'))
                    cache[page] = (parser.sources, actual_page, parser.headwords)
                except (urllib.error.URLError, TimeoutError) as error:
                    cache[page] = ([], page, set())
                    if isinstance(error, urllib.error.HTTPError) and error.code in (403,429):
                        print('SOURCE_BLOCKED', error.code, word, flush=True)
                        save(records, tokens, primary)
                        raise SystemExit(2)
            sources, actual_page, headwords = cache[page]
            audio = exact_audio(word, sources, headwords)
            if audio:
                page = actual_page
                break
        if audio:
            try:
                raw, _ = fetch(audio)
                filename = re.sub(r"[^a-z0-9-]", '_', word)+'.mp3'
                file = OUT / filename
                file.write_bytes(raw)
                duration = validate(file)
                if not 0.1 <= duration <= 15:
                    raise ValueError('Invalid duration')
                records[word] = {'word':word, 'filename':filename, 'page':page,
                    'audioUrl':audio, 'accent':'US', 'artist':'Oxford Learners Dictionaries',
                    'sha256':hashlib.sha256(raw).hexdigest(), 'duration':duration,
                    'verification':'Exact recorded word filename; official US source; full MP3 decode passed'}
                print('OK', word, flush=True)
            except (urllib.error.URLError, TimeoutError, ValueError, subprocess.CalledProcessError) as error:
                print('FAILED_AUDIO', word, str(error), flush=True)
        else:
            print('NO_EXACT_RECORDING', word, flush=True)
        save(records, tokens, primary)
        if index % 25 == 0:
            print('PROGRESS', index+1, '/', len(missing), 'SAVED', len(records), flush=True)
        time.sleep(0.1)
    print('DONE', len(records), 'example recordings', flush=True)


if __name__ == '__main__':
    main()
