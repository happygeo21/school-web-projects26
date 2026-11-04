"""Exercise the actual workflow's environment gate without any network changes."""
import io
import json
import os
from pathlib import Path
import textwrap
import unittest
from unittest.mock import patch
from urllib.error import HTTPError

ROOT = Path(__file__).resolve().parents[4]
WORKFLOW = ROOT / '.github/workflows/teacher-geoteacher-d1-migrate.yml'
source = WORKFLOW.read_text()
block = source.split('name: Require a pre-existing reviewer-protected environment', 1)[1].split('run: |', 1)[1].split('\n  migrate:', 1)[0]
GATE = compile(textwrap.dedent(block).strip(), 'migration-approval-gate', 'exec')

class MigrationGateTests(unittest.TestCase):
    def run_gate(self, data):
        with patch.dict(os.environ, {'GH_TOKEN':'TEST_TOKEN', 'REPOSITORY':'happygeo21/school-web-projects26'}):
            with patch('urllib.request.urlopen', return_value=io.BytesIO(json.dumps(data).encode())) as request:
                exec(GATE, {})
                self.assertTrue(request.call_args.args[0].full_url.endswith('/environments/geoteacher-d1-production'))

    def test_unreadable_approval_environment_fails_before_migration(self):
        for status in [401,403,404]:
            with self.subTest(status=status), patch.dict(os.environ, {'GH_TOKEN':'TEST_TOKEN','REPOSITORY':'happygeo21/school-web-projects26'}):
                with patch('urllib.request.urlopen', side_effect=HTTPError('https://api.github.com/', status, 'PRIVATE_MESSAGE', {}, io.BytesIO(b'PRIVATE_BODY'))):
                    with self.assertRaisesRegex(SystemExit, '^Protected approval environment unavailable. No database changes.$'):
                        exec(GATE,{})

    def test_missing_required_reviewer_fails_before_migration(self):
        for rules in [[],[{'type':'wait_timer'}],[{'type':'required_reviewers','reviewers':[]}]]:
            with self.subTest(rules=rules), self.assertRaises(SystemExit):
                self.run_gate({'protection_rules':rules})

    def test_preexisting_required_reviewer_passes_metadata_gate(self):
        self.run_gate({'protection_rules':[{'type':'required_reviewers','reviewers':[{'type':'User','reviewer':{'id':1}}]}]})

if __name__=='__main__': unittest.main()
