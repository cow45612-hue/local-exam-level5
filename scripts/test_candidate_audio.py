import unittest
from pathlib import Path
import download_human_audio as collector


class CandidateTests(unittest.TestCase):
    def test_original_extension_is_preserved(self):
        self.assertTrue(hasattr(collector, "original_path"))
        self.assertEqual(collector.original_path({"id": 9, "originalExtension": "wav"}), collector.OUT / "9.wav")
        self.assertEqual(collector.original_path({"id": 6}), collector.OUT / "6.ogg")

    def test_reject_wrong_word_and_prefer_us(self):
        self.assertTrue(hasattr(collector, "select_candidate"))
        word = {"id": 259, "word": "tag", "type": "noun"}
        candidates = [{"file": "en-us-stag.ogg", "details": "|a=US", "status": "reject_word_mismatch_stag_not_tag"}, {"file": "En-au-tag.ogg", "details": "|a=AU"}]
        self.assertIsNone(collector.select_candidate(word, candidates), "Do not substitute Australian audio")
        candidates = [{"file": "uk.wav", "details": "|a=Southern England"}, {"file": "us.wav", "details": "|a=US"}]
        self.assertEqual(collector.select_candidate(word, candidates)["file"], "us.wav")

    def test_part_of_speech(self):
        self.assertTrue(hasattr(collector, "select_candidate"))
        candidates = [{"file": "En-us-perfect-verb.ogg", "details": "|a=US"}, {"file": "En-us-perfect-adj.ogg", "details": "|a=GA"}]
        self.assertIn("-adj", collector.select_candidate({"id": 180, "type": "adjective"}, candidates)["file"])
        candidates = [{"file": "En-us-record-verb.ogg", "details": "|a=US"}, {"file": "En-us-record-noun.ogg", "details": "|a=US"}]
        self.assertIn("-noun", collector.select_candidate({"id": 210, "type": "noun"}, candidates)["file"])

    def test_adjust_is_not_an_adjective_marker(self):
        candidate = {"file": "en-us-adjust.ogg", "details": "|a=US"}
        self.assertIsNotNone(collector.select_candidate({"id": 9, "type": "verb"}, [candidate]))

    def test_uk_only_is_not_installed(self):
        self.assertIsNone(collector.select_candidate({"id": 9, "type": "verb"}, [{"file": "adjust.wav", "details": "|a=Southern England"}]))

    def test_accent_classification(self):
        self.assertTrue(hasattr(collector, "candidate_accent"))
        for detail, expected in [("|a=US", "US"), ("|a=Southern England", "UK"), ("|a=Brisbane", "AU"), ("|a=Canada", "CA")]:
            self.assertEqual(collector.candidate_accent({"details": detail, "file": "sample.wav"}), expected)


if __name__ == "__main__":
    unittest.main()
