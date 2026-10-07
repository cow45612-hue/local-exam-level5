"""Generate only the 18 approved missing example tokens with Pocket TTS 3.3.0.

Install pocket-tts==3.3.0 in an isolated environment, then run this script.
Existing recordings are never replaced. Progress is saved after every token.
"""
import hashlib
import json
import re
import subprocess
from importlib.metadata import version

import fetch_example_audio as collector

MODEL = 'english_2026-09'
VOICE = 'cosette'
SPOKEN_TEXT = {
    'angstroms': 'Angstroms.', 'barcodes': 'Barcodes.', 'e-log': 'E log.',
    'euv': 'E U V.', 'fabs': 'Fabs.', 'gowning': 'Gowning.',
    'loadlock': 'Load lock.', 'mes': 'M E S.', 're-certified': 'Recertified.',
    'rf': 'R F.', 'spc': 'S P C.', 'tag-out': 'Tag out.',
    'tsmc': 'T S M C.', "tsmc's": "T S M C's.",
    'twelve-inch': 'Twelve inch.', 'wip': 'W I P.',
    'world-leading': 'World leading.', 'zero-defect': 'Zero defect.',
}


def pending_words(tokens, primary, records):
    return sorted(tokens.intersection(SPOKEN_TEXT) - primary - records.keys())


def main():
    import numpy as np
    import torch
    from pocket_tts import TTSModel
    from scipy.io import wavfile

    if version('pocket-tts') != '3.3.0':
        raise RuntimeError('Use pocket-tts==3.3.0 for the documented voice/model')
    root, out = collector.ROOT, collector.OUT
    vocabulary = json.loads((root/'tsmc-vocabulary.json').read_text(encoding='utf-8'))
    tokens = collector.clicked_tokens(vocabulary)
    primary = {r['word'].lower() for r in json.loads((root/'audio-human/sources.json').read_text(encoding='utf-8'))}
    records = {r['word']: r for r in json.loads((out/'sources.json').read_text(encoding='utf-8'))}
    pending = pending_words(tokens, primary, records)
    if not pending:
        collector.save(records, tokens, primary)
        print('No approved tokens missing.', flush=True)
        return
    torch.set_num_threads(2)
    model = TTSModel.load_model(language=MODEL)
    voice = model.get_state_for_audio_prompt(VOICE)
    for word in pending:
        torch.manual_seed(20261008)
        filename = 'ai-' + re.sub(r'[^a-z0-9-]', '_', word)
        wav = out/(filename+'.wav')
        mp3 = out/(filename+'.mp3')
        samples = model.generate_audio(voice, SPOKEN_TEXT[word]).detach().cpu().numpy()
        if not np.isfinite(samples).all() or float(np.max(np.abs(samples))) < 0.001:
            raise ValueError('Silent or invalid output: '+word)
        wavfile.write(wav, model.sample_rate, samples)
        subprocess.run(['ffmpeg', '-y', '-v', 'error', '-i', str(wav),
                        '-codec:a', 'libmp3lame', '-q:a', '2', str(mp3)], check=True)
        duration = collector.validate(mp3)
        if not 0.15 <= duration <= 8:
            raise ValueError('Unexpected duration: '+word)
        records[word] = {
            'word': word, 'filename': mp3.name, 'originalFilename': wav.name,
            'sha256': hashlib.sha256(mp3.read_bytes()).hexdigest(),
            'originalSha256': hashlib.sha256(wav.read_bytes()).hexdigest(),
            'duration': duration, 'page': 'https://github.com/kyutai-labs/pocket-tts',
            'accent': 'US', 'artist': 'AI: Pocket TTS / Cosette',
            'recordingType': 'ai_generated', 'model': MODEL, 'modelVersion': '3.3.0',
            'voice': VOICE, 'spokenText': SPOKEN_TEXT[word], 'seed': 20261008,
            'license': 'MIT model/code; CC BY-NC 4.0 voice reference',
            'licenseUrl': 'https://creativecommons.org/licenses/by-nc/4.0/',
            'voiceSource': 'https://huggingface.co/kyutai/tts-voices/blob/main/expresso/ex04-ex02_confused_001_channel1_499s.wav',
            'voiceCredit': 'Expresso, Meta AI (Nguyen et al., 2023), speaker ex04',
            'verification': 'AI-generated; finite non-silent waveform; full MP3 decode passed; pronunciation not independently reviewed',
        }
        collector.save(records, tokens, primary)
        print('SAVED', word, round(duration, 3), flush=True)
    print('DONE', len(pending), 'AI clips; original recordings preserved.', flush=True)


if __name__ == '__main__':
    main()
