import unittest
from fetch_example_commons import exact_recording


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


if __name__ == '__main__':
    unittest.main()
