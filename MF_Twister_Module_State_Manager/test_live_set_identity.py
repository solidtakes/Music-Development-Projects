import unittest
from live_set_identity import set_key_from_path, set_key_from_song


class Song(object):
    def __init__(self, path):
        self.file_path = path


class BrokenSong(object):
    @property
    def file_path(self):
        raise AttributeError("not exposed")


class LiveSetIdentityTests(unittest.TestCase):
    def test_empty_or_unsaved_set_has_no_identity(self):
        self.assertIsNone(set_key_from_path(""))
        self.assertIsNone(set_key_from_path(None))
        self.assertIsNone(set_key_from_song(Song("")))

    def test_saved_windows_path_is_case_insensitive_and_stable(self):
        a = set_key_from_path(r"C:\\Users\\Artist\\Project\\Song.als")
        b = set_key_from_path(r"c:\\users\\artist\\project\\song.als")
        self.assertEqual(a, b)
        self.assertTrue(a.startswith("live-set-path-v1:"))

    def test_save_as_creates_a_distinct_path_identity(self):
        a = set_key_from_path(r"C:\\ProjectA\\Song.als")
        b = set_key_from_path(r"D:\\ProjectB\\Song.als")
        self.assertNotEqual(a, b)

    def test_relative_paths_are_rejected(self):
        self.assertIsNone(set_key_from_path("Project/Song.als"))

    def test_unavailable_live_property_falls_back_safely(self):
        self.assertIsNone(set_key_from_song(BrokenSong()))
        self.assertIsNone(set_key_from_song(None))


if __name__ == "__main__":
    unittest.main()
