import unittest
import generate_missing_ai_audio as generator


class AiAudioTests(unittest.TestCase):
    def test_only_approved_missing_tokens(self):
        plan = generator.pending_words({'euv', 'active', 'unknown', 'barcodes'}, {'active'}, {'barcodes': {}})
        self.assertEqual(plan, ['euv'])

    def test_explicit_initialisms_and_possessive(self):
        self.assertEqual(generator.SPOKEN_TEXT['euv'], 'E U V.')
        self.assertEqual(generator.SPOKEN_TEXT["tsmc's"], "T S M C's.")
        self.assertEqual(len(generator.SPOKEN_TEXT), 18)


if __name__ == '__main__':
    unittest.main()
