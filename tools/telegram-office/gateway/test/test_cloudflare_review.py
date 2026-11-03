import importlib.util
import io
import json
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

SCRIPTS = Path(__file__).resolve().parents[1] / 'scripts'
sys.path.insert(0, str(SCRIPTS))
import cloudflare_review as review

class ReviewTests(unittest.TestCase):
    def test_bindings_never_emit_values_or_unknown_names(self):
        result=review.binding_summary([{'name':'NOTION_API_TOKEN','type':'secret_text','text':'DO_NOT_PRINT'}, {'name':'PRIVATE_NAME','type':'plain_text','text':'DO_NOT_PRINT'}])
        encoded=json.dumps(result)
        self.assertNotIn('DO_NOT_PRINT',encoded)
        self.assertNotIn('PRIVATE_NAME',encoded)
        self.assertEqual(result['other_binding_count'],1)

    def test_source_only_emits_hash_and_reference_match(self):
        import base64
        with tempfile.TemporaryDirectory() as root:
            path=Path(root);(path/'src').mkdir();(path/'src/index.js').write_text('export default {};\n')
            modules=[{'name':'PRIVATE_MODULE','content_base64':base64.b64encode(b'export default {};\n').decode()}]
            result=review.compare_modules(modules,{'main':path})
        self.assertEqual(result['modules'][0]['reference_matches'],['main:index.js:exact'])
        self.assertNotIn('export default',json.dumps(result))
        self.assertNotIn('PRIVATE_MODULE',json.dumps(result))

    def test_schema_query_is_fixed_select_and_reports_permission_separately(self):
        from urllib.error import HTTPError
        seen=[]
        def request(req,timeout):
            seen.append(req)
            raise HTTPError(req.full_url,403,'PRIVATE_ERROR',{},io.BytesIO(b'PRIVATE_ERROR_BODY'))
        with patch.object(review,'urlopen',request):
            data,status=review.attempt(lambda:review.read_schema('/accounts/test','TEST_TOKEN'))
        self.assertIsNone(data)
        self.assertEqual(status,{'readable':False,'http_status':403})
        req=seen[0]
        self.assertEqual(req.method,'POST')
        self.assertEqual(json.loads(req.data),{'sql':review.SCHEMA_QUERY})
        self.assertTrue(review.SCHEMA_QUERY.startswith('SELECT '))
        self.assertNotIn('PRIVATE',json.dumps(status))

    def test_schema_absence_and_existing_structure_never_request_creation(self):
        sql='CREATE TABLE task_approvals (id TEXT PRIMARY KEY);\nCREATE INDEX task_approvals_expiry ON task_approvals(state, expires_at);'
        self.assertEqual(review.schema_summary([],sql)['state'],'not_applied')
        rows=[{'type':'table','name':'task_approvals','sql':'CREATE TABLE task_approvals (id TEXT PRIMARY KEY)'},{'type':'index','name':'task_approvals_expiry','sql':'CREATE INDEX task_approvals_expiry ON task_approvals(state, expires_at)'}]
        self.assertEqual(review.schema_summary(rows,sql)['state'],'already_matches')
        rows[0]['sql']='CREATE TABLE task_approvals (id INTEGER)'
        result=review.schema_summary(rows,sql)
        self.assertEqual(result['state'],'schema_mismatch')
        self.assertTrue(result['skip_creation'])

    def test_unknown_remote_table_names_stay_private(self):
        result=review.schema_summary([{'type':'table','name':'PRIVATE_SCHOOL_TABLE','sql':'PRIVATE_BODY'}],'CREATE TABLE task_approvals (id TEXT); CREATE INDEX task_approvals_expiry ON task_approvals(state, expires_at);')
        self.assertEqual(result['other_table_count'],1)
        self.assertFalse(result['migration_safe_to_consider'])
        self.assertNotIn('PRIVATE',json.dumps(result))

if __name__=='__main__': unittest.main()
