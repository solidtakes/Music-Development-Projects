import importlib.util, io, pathlib, unittest, zipfile

spec=importlib.util.spec_from_file_location('source_package',pathlib.Path(__file__).with_name('package.py'))
module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)

class PackageTests(unittest.TestCase):
    def test_whitelist_rejects_traversal_vendor_private_and_emitted_files(self):
        for p in ['../secret','/absolute','ableton-offline-processing/spikes/s5-t1-trial/../secret.json',
                  'ableton-offline-processing/spikes/s5-t1-trial/.env',
                  'ableton-offline-processing/spikes/s5-t1-trial/private.wav',
                  'ableton-offline-processing/spikes/s5-t1-trial/node_modules/sdk/index.mjs',
                  'ableton-offline-processing/spikes/s5-t1-trial/.build/x.json',
                  'unrelated/project.als','C:/escape.ts',
                  'ableton-offline-processing/spikes/s5-t1-trial/C:/escape.ts']:
            self.assertFalse(module.allowed(p),p)
        self.assertTrue(module.allowed('ableton-offline-processing/spikes/s5-t1-trial/src/profile.ts'))
    def test_stored_archive_is_repeatable_and_safe(self):
        one,two=io.BytesIO(),io.BytesIO();members={'src/test.ts':b'synthetic\n','manifest.json':b'{}\n'}
        module.archive(one,members);module.archive(two,members)
        self.assertEqual(one.getvalue(),two.getvalue())
        with zipfile.ZipFile(one) as z:
            self.assertEqual(z.testzip(),None)
            for x in z.infolist():
                self.assertEqual(x.compress_type,zipfile.ZIP_STORED);self.assertEqual(x.create_system,3)
        with self.assertRaises(ValueError):module.archive(io.BytesIO(),{'../escape':b''})
        with self.assertRaises(ValueError):module.archive(io.BytesIO(),{'C:/escape':b''})
        with self.assertRaises(ValueError):module.archive(io.BytesIO(),{'src/a.ts':b'','src/A.ts':b''})
    def test_bad_sha_is_refused(self):
        with self.assertRaises(ValueError):module.package('main','never-created.zip')

if __name__=='__main__':unittest.main()
