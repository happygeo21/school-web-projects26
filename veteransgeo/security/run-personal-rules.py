#!/usr/bin/env python3
"""Run an external private package with exact Rules, integrity checks and sanitized output."""
import hashlib
import json
import os
from pathlib import Path
import re
import shlex
import shutil
import signal
import socket
import subprocess
import sys
import tempfile
import threading

EXPECTED_RULES = None
ANSI = re.compile(r'\x1b\[[0-?]*[ -/]*[@-~]')

def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def check_access(path):
    if os.name == 'nt':
        script = Path(__file__).with_name('private-file-access.ps1')
        check = subprocess.run([os.environ.get('VETERANSGEO_POWERSHELL', 'pwsh'), '-NoProfile', '-NonInteractive', '-File', str(script), '-LiteralPath', str(path)], capture_output=True, text=True, timeout=15)
        if check.returncode != 0 or check.stdout.strip() != 'private-windows-acl-verified':
            raise ValueError()

def validate(root):
    if os.name not in ('posix', 'nt') or sys.version_info < (3, 9):
        raise ValueError()
    if os.name == 'posix' and root.stat().st_mode & 0o077:
        raise ValueError()
    if any((directory / '.git').exists() for directory in [root, *root.parents]):
        raise ValueError()
    if shutil.which('git'):
        env = os.environ.copy()
        env['LC_ALL'] = 'C'
        probe = subprocess.run(['git', '-C', str(root), 'rev-parse', '--is-inside-work-tree'], capture_output=True, text=True, env=env)
        if probe.returncode == 0 or 'not a git repository' not in probe.stderr:
            raise ValueError()
    check_access(root / 'integrity.json')
    manifest = json.loads((root / 'integrity.json').read_text(encoding='utf-8'))
    if manifest['rulesSHA256'] != EXPECTED_RULES:
        raise ValueError()
    for name, expected in manifest['files'].items():
        path = root / name
        if Path(name).is_absolute() or '..' in Path(name).parts or not path.is_file():
            raise ValueError()
        cursor = root
        for part in Path(name).parts:
            cursor = cursor / part
            if cursor.is_symlink():
                raise ValueError()
        check_access(path)
        if (os.name == 'posix' and path.stat().st_mode & 0o077) or sha(path) != expected:
            raise ValueError()
    if sha(root / 'prepared-1/test-only.rules.json') != EXPECTED_RULES:
        raise ValueError()
    roles = json.loads((root / 'roles.json').read_text(encoding='utf-8'))
    if set(roles) != {'teachers'} or set(roles['teachers']) != {'approved', 'unapproved'}:
        raise ValueError()
    a, b = roles['teachers']['approved'], roles['teachers']['unapproved']
    for role in (a, b):
        if set(role) != {'uid', 'email'} or not all(isinstance(v, str) and v for v in role.values()):
            raise ValueError()
    if a['uid'] == b['uid'] or a['email'] == b['email']:
        raise ValueError()
    rules = json.loads((root / 'prepared-1/test-only.rules.json').read_text(encoding='utf-8'))
    strings = []
    def visit(value):
        if isinstance(value, str):
            strings.append(value)
        elif isinstance(value, dict):
            for child in value.values():
                visit(child)
    visit(rules)
    if not any(json.dumps(a['uid']) in value and json.dumps(a['email']) in value for value in strings):
        raise ValueError()
    if not shutil.which('node') or not shutil.which('java'):
        raise ValueError()
    node = subprocess.run(['node', '--version'], capture_output=True, text=True).stdout.strip()
    java = subprocess.run(['java', '-version'], capture_output=True, text=True)
    version = re.search(r'(?:openjdk|java) version "([0-9][0-9._+-]*)"', java.stderr + java.stdout)
    if not re.fullmatch(r'v[0-9]+\.[0-9]+\.[0-9]+', node) or int(node[1:].split('.')[0]) < 22 or not version or int(version[1].split('.')[0]) < 21:
        raise ValueError()
    cli = root / 'node_modules/firebase-tools/lib/bin/firebase.js'
    if not cli.is_file():
        raise ValueError()
    if not manifest['testNames']:
        raise ValueError()
    return manifest, {'kind': 'Windows-native-official-RTDB-emulator' if os.name == 'nt' else 'local-Linux-official-RTDB-emulator', 'project': 'demo-veteransgeo', 'host': '127.0.0.1:9000', 'node': node, 'java': version[1], 'python': '.'.join(map(str, sys.version_info[:3]))}

def inspect_line(line, state, allowed):
    clean = ANSI.sub('', line).strip()
    for key in ('pass', 'fail', 'cancelled', 'skipped'):
        match = re.fullmatch(r'# ' + key + r' (\d+)', clean)
        if match:
            state[key] = int(match[1])
    if clean.startswith('not ok '):
        for name in allowed:
            if clean.endswith(' - ' + name):
                state['failedNames'].add(name)
    if 'CONNECT tunnel failed, response 403' in clean:
        state['connect403'] = True
    if 'downloading firebase-database-emulator' in clean:
        state['downloadAttempt'] = True

def run(root, manifest):
    # Never connect to an unrelated emulator already running on the expected port.
    with socket.socket() as port:
        port.bind(('127.0.0.1', 9000))
    state = {'pass': None, 'fail': None, 'cancelled': None, 'skipped': None, 'failedNames': set(), 'connect403': False, 'downloadAttempt': False}
    timed_out = threading.Event()
    env = os.environ.copy()
    env['CI'] = 'true'
    env['FIREBASE_DATABASE_EMULATOR_HOST'] = '127.0.0.1:9000'
    env['VETERANSGEO_RULE_MODE'] = 'exact-personal-only'
    # CLI and emulator raw debug streams go to /dev/null, never a user log file.
    # TLS, proxy, download integrity and authentication behavior stay unchanged.
    with tempfile.TemporaryDirectory(prefix='veteransgeo-personal-rules-') as directory:
        runtime = Path(directory)
        for name in ['firebase-debug.log'] + ['firebase-debug.' + str(i) + '.log' for i in range(1, 10)] + ['database-debug.log']:

            if os.name != 'nt':
                (runtime / name).symlink_to(os.devnull)
        config = {'database': {'rules': str(root / 'prepared-1/test-only.rules.json')}, 'emulators': {'database': {'host': '127.0.0.1', 'port': 9000}, 'ui': {'enabled': False}, 'singleProjectMode': True}}
        config_path = runtime / 'firebase.json'
        config_path.write_text(json.dumps(config))
        test_args = ['node', '--test', '--test-reporter=tap', str(root / 'emulator-1/candidate.test.cjs')]
        test = subprocess.list2cmdline(test_args) if os.name == 'nt' else shlex.join(test_args)
        proc = subprocess.Popen(['node', str(Path(__file__).with_name('private-emulator-cli.cjs')), '--package', str(root), 'emulators:exec', '--project', 'demo-veteransgeo', '--config', str(config_path), '--only', 'database', test], cwd=runtime, env=env, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, encoding='utf-8', errors='replace', start_new_session=os.name != 'nt', creationflags=subprocess.CREATE_NEW_PROCESS_GROUP if os.name == 'nt' else 0)
        def stop():
            timed_out.set()
            try:
                subprocess.run(['taskkill', '/PID', str(proc.pid), '/T', '/F'], capture_output=True) if os.name == 'nt' else os.killpg(proc.pid, signal.SIGTERM)
            except ProcessLookupError:
                pass
        timer = threading.Timer(720, stop)
        timer.daemon = True
        timer.start()
        try:
            for line in proc.stdout:
                inspect_line(line, state, manifest['testNames'])
            code = proc.wait()
        except BaseException:
            stop()
            try:
                proc.wait(timeout=10)
            except subprocess.TimeoutExpired:
                subprocess.run(['taskkill', '/PID', str(proc.pid), '/T', '/F'], capture_output=True) if os.name == 'nt' else os.killpg(proc.pid, signal.SIGKILL)
                proc.wait()
            raise
        finally:
            timer.cancel()
        # Pinned CLI writes only the null sinks above for this database-only run.
        unexpected_log = any(path.is_file() and not path.is_symlink() for path in runtime.glob('*.log'))
    unchanged = all((root / name).is_file() and sha(root / name) == expected for name, expected in manifest['files'].items())
    success = code == 0 and state['pass'] == len(manifest['testNames']) and state['fail'] == 0 and state['cancelled'] == 0 and state['skipped'] == 0 and unchanged and not timed_out.is_set() and not unexpected_log
    failures = sorted(state['failedNames'])
    if not success and not failures:
        failures = ['emulator-download-or-startup-unavailable' if state['downloadAttempt'] else 'emulator-or-test-execution-incomplete']
    if state['connect403']:
        failures.append('network-CONNECT-403')
    if not unchanged:
        failures.append('package-integrity-changed-during-run')
    if unexpected_log:
        failures.append('unexpected-raw-log-file')
    if timed_out.is_set():
        failures.append('emulator-timeout')
    return success, state['pass'], state['fail'], failures

def main():
    os.umask(0o077)
    import argparse
    global EXPECTED_RULES
    parser = argparse.ArgumentParser(description='External private package only; never publishes or deploys')
    parser.add_argument('--package', required=True)
    parser.add_argument('--expected-sha256', required=True)
    parser.add_argument('--check-only', action='store_true')
    args = parser.parse_args()
    if not re.fullmatch('[a-f0-9]{64}', args.expected_sha256):
        parser.error('A verified SHA256 is required')
    EXPECTED_RULES = args.expected_sha256
    root = Path(args.package).resolve()
    manifest = {'testNames': []}
    environment = {'kind': 'preflight-not-completed'}
    success, passed, failed, failures = False, None, None, ['private-package-preflight-failed']
    try:
        manifest, environment = validate(root)
        if args.check_only:
            print(json.dumps({'success': False, 'passed': None, 'failed': None, 'rulesSHA256': EXPECTED_RULES, 'environment': environment, 'failedCases': ['check-only-no-emulator-tests-run']}))
            return
        success, passed, failed, failures = run(root, manifest)
    except KeyboardInterrupt:
        failures = ['execution-interrupted']
    except Exception:
        pass
    report = {'success': success, 'passed': passed, 'failed': failed, 'rulesSHA256': EXPECTED_RULES, 'verifiedRulesSHA256': EXPECTED_RULES if success else None, 'environment': environment, 'failedCases': failures, 'checkedItems': manifest['testNames'] if passed is not None else [], 'executedAt': __import__('datetime').datetime.now(__import__('datetime').timezone.utc).isoformat()}
    result_dir = root / 'results'
    result_dir.mkdir(mode=0o700, exist_ok=True)
    fd, _ = tempfile.mkstemp(prefix='rules-result-', suffix='.json', dir=result_dir)
    with os.fdopen(fd, 'w') as stream:
        json.dump(report, stream, indent=2)
        stream.write('\n')
    print(json.dumps(report))
    if not success:
        sys.exit(2)

if __name__ == '__main__':
    main()
