import unittest
from unittest.mock import patch

import build_phrase_audio as builder


class PhraseTests(unittest.TestCase):
    def test_explicit_segmented_metadata(self):
        parts = [dict(word='air', accent='US', page='https://example.org/air', artist='Speaker'),
                 dict(word='shower', accent='US', page='https://example.org/shower', artist='Speaker')]
        record = builder.phrase_metadata({'id': 11, 'word': 'air shower'}, parts, 'hash', 2.0)
        self.assertEqual(record['recordingType'], 'segmented_human')
        self.assertEqual(record['segmentWords'], ['air', 'shower'])
        self.assertEqual(len(record['segments']), 2)
        self.assertEqual(record['accent'], 'US')

    def test_no_other_accent_substitution(self):
        with self.assertRaises(ValueError):
            builder.phrase_metadata({'id': 11, 'word': 'air shower'},
                                    [dict(word='air', accent='UK')], 'hash', 1)

    def test_no_empty_phrase(self):
        with self.assertRaises(ValueError):
            builder.phrase_metadata({'id': 11, 'word': 'air shower'}, [], 'hash', 1)

    def test_mapping_preserves_segmented_label(self):
        record = dict(id=11, word='air shower', sha256='abc', artist='Speaker', page='page',
                      license='license', licenseUrl='url', accent='US',
                      recordingType='segmented_human', segmentWords=['air', 'shower'])
        import download_human_audio as collector
        self.assertEqual(collector.playback_record(record)['recordingType'], 'segmented_human')
        self.assertEqual(collector.playback_record(record)['segmentWords'], ['air', 'shower'])


if __name__ == '__main__':
    unittest.main()
