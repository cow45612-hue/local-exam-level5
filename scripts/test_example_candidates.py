import unittest
from install_example_candidates import verified_candidate


class CandidateTests(unittest.TestCase):
    def candidate(self):
        return {'word': 'nitrile', 'spokenText': 'nitrile',
            'page': 'https://www.merriam-webster.com/dictionary/nitrile',
            'audioUrl': 'https://media.merriam-webster.com/audio/prons/en/us/mp3/n/nitril01.mp3',
            'observedLink': 'https://www.merriam-webster.com/dictionary/nitrile?pronunciation&lang=en_us&dir=n&file=nitril01'}

    def test_valid(self):
        self.assertTrue(verified_candidate(self.candidate()))

    def test_reject_wrong_word_and_accent(self):
        record = self.candidate()
        record['spokenText'] = 'nitrate'
        self.assertFalse(verified_candidate(record))
        record = self.candidate()
        record['observedLink'] = record['observedLink'].replace('en_us', 'en_uk')
        self.assertFalse(verified_candidate(record))

    def test_reject_unrelated_audio(self):
        record = self.candidate()
        record['audioUrl'] = record['audioUrl'].replace('nitril01', 'discre04')
        self.assertFalse(verified_candidate(record))

    def test_forvo_speaker_and_exact_word(self):
        record = {'word': 'particles', 'spokenText': 'particles', 'artist': 'rdbedsole',
            'speakerLocation': 'United States', 'language': 'English', 'recordingId': '1105548',
            'page': 'https://forvo.com/word/particles/',
            'audioUrl': 'https://audio12.forvo.com/audios/mp3/u/m/um_8986237_39_1373154_1.mp3'}
        self.assertTrue(verified_candidate(record))
        record['speakerLocation'] = 'United Kingdom'
        self.assertFalse(verified_candidate(record))
        record['speakerLocation'] = 'United States'
        record['word'] = 'particle'
        self.assertFalse(verified_candidate(record))


if __name__ == '__main__':
    unittest.main()
