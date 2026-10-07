import unittest
import json
import tempfile
from pathlib import Path
from unittest.mock import patch
import fetch_example_audio as collector


class ExampleAudioTests(unittest.TestCase):
    def test_ai_metadata_survives_save_and_is_counted_separately(self):
        record = {'word': 'euv', 'filename': 'ai-euv.mp3', 'sha256': 'a'*64,
                  'page': 'https://github.com/kyutai-labs/pocket-tts',
                  'artist': 'Pocket TTS / cosette', 'recordingType': 'ai_generated',
                  'model': 'english_2026-09', 'voice': 'cosette', 'spokenText': 'E U V.'}
        with tempfile.TemporaryDirectory() as folder, patch.object(collector, 'OUT', Path(folder)):
            collector.save({'euv': record}, {'active', 'euv', 'missing'}, {'active'})
            mapping = (Path(folder)/'recordings.js').read_text(encoding='utf-8')
            self.assertIn('"recordingType": "ai_generated"', mapping)
            coverage = json.loads((Path(folder)/'coverage.json').read_text())
            self.assertEqual(coverage['aiRecordingCount'], 1)
            self.assertEqual(coverage['availableCount'], 2)
            self.assertEqual(coverage['missing'], ['missing'])

    def test_same_tokens_as_clickable_sentence(self):
        words = collector.clicked_tokens([{'fabPhrase': 'E-log 25 wafers',
                                           'exampleSentence': "Make sure TSMC's run-card is ready."}])
        self.assertEqual(words, {'e-log', '25', 'wafers', 'make', 'sure', "tsmc's", 'run-card', 'is', 'ready'})

    def test_exact_inflection_only(self):
        sources = ['https://www.oxfordlearnersdictionaries.com/media/english/us_pron/w/wa/wafer/wafer__us_1.mp3',
                   'https://www.oxfordlearnersdictionaries.com/media/english/us_pron/w/wa/wafer/wafers__us_1.mp3']
        self.assertEqual(collector.exact_audio('wafers', sources), sources[1])
        self.assertIsNone(collector.exact_audio('wafered', sources))

    def test_no_uk_or_arbitrary_hosts(self):
        self.assertIsNone(collector.exact_audio('make', ['https://example.org/us_pron/make__us_1.mp3']))
        self.assertIsNone(collector.exact_audio('make', ['https://www.oxfordlearnersdictionaries.com/media/english/uk_pron/make__gb_1.mp3']))

    def test_hyphen_normalization(self):
        url = 'https://www.oxfordlearnersdictionaries.com/media/english/us_pron/d/dou/doubl/double_check_1_us_1.mp3'
        self.assertEqual(collector.exact_audio('double-check', [url]), url)

    def test_x_prefix_requires_matching_headword(self):
        url = 'https://www.oxfordlearnersdictionaries.com/media/english/us_pron/x/xco/xconf/xconfiguration__us_1.mp3'
        self.assertIsNone(collector.exact_audio('configuration', [url]))
        self.assertEqual(collector.exact_audio('configuration', [url], {'configuration'}), url)
        self.assertIsNone(collector.exact_audio('configuration', [url], {'configure'}))

    def test_numbered_entries_are_checked(self):
        self.assertIn('do_1', collector.entry_candidates('do'))

    def test_parse_headword_ignores_homonym_number(self):
        parser = collector.AudioParser('https://www.oxfordlearnersdictionaries.com')
        parser.feed('<h1 class="headword">do<span class="hm">1</span></h1>')
        self.assertEqual(parser.headwords, {'do'})


if __name__ == '__main__':
    unittest.main()
