import unittest
from fetch_example_commons import exact_recording, wiktionary_audio


class CommonsExampleTests(unittest.TestCase):
    def test_exact_us_inflection(self):
        self.assertTrue(exact_recording('boxes', 'File:En-us-boxes.ogg', {}))
        self.assertFalse(exact_recording('boxes', 'File:En-us-box.ogg', {}))

    def test_generic_requires_us_metadata(self):
        self.assertFalse(exact_recording('contact', 'File:En-contact.ogg', {}))
        self.assertTrue(exact_recording('contact', 'File:En-contact.ogg',
                        {'Categories': {'value': 'U.S. English pronunciation'}}))

    def test_reject_other_accents_and_unrelated_audio(self):
        self.assertFalse(exact_recording('labor', 'File:En-uk-labor.ogg', {}))
        self.assertFalse(exact_recording('labor', 'File:En-us-laboratory.ogg', {}))

    def test_numbered_recording(self):
        self.assertTrue(exact_recording('do', 'File:En-us-do2.ogg', {}))

    def test_english_section_and_us_label(self):
        text = '==English==\n{{audio|en|LL-Q1860 (eng)-Alice-particles.wav|a=General American}}\n==French==\n{{audio|fr|French-particles.wav}}'
        self.assertEqual(wiktionary_audio(text), [('File:LL-Q1860 (eng)-Alice-particles.wav', True)])

    def test_lingua_libre_requires_us_proof(self):
        title = 'File:LL-Q1860 (eng)-Alice-particles.wav'
        self.assertFalse(exact_recording('particles', title, {}))
        self.assertTrue(exact_recording('particles', title, {}, us_label=True))
        self.assertFalse(exact_recording('particle', title, {}, us_label=True))


if __name__ == '__main__':
    unittest.main()
