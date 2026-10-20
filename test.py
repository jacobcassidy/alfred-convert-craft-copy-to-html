from pathlib import Path
import json, plistlib, subprocess
p = Path(__file__).resolve().parent
r = json.loads(subprocess.check_output(['/usr/bin/osascript', '-l', 'JavaScript', str(p / 'convert.js'), str(p / 'test.rtf')]))
for expected in ('<i>are</i>', '<b>immutable</b>', '<s>unique</s>', 'frozenset([1, 2, 4])</code>', '&lt; &amp; &gt;', '<br>next line'):
    assert expected in r['html'], expected
assert r['plain'] == 'Frozen sets are merely immutable. unique frozenset([1, 2, 4]) < & >\nnext line'
info = plistlib.loads((p / 'info.plist').read_bytes())
objects = {o['uid']: o for o in info['objects']}
hotkey = objects['copy-hotkey']['config']
assert hotkey['hotkey'] == 8 and hotkey['hotmod'] == 1572864
assert info['connections']['copy-hotkey'][0]['destinationuid'] == 'copy-convert'
assert '--copy' in objects['copy-convert']['config']['script']
assert '--copy' not in objects['convert']['config']['script']
for edges in info['connections'].values():
    for edge in edges:
        assert edge['destinationuid'] in objects
print('Conversion and hotkey wiring checks passed.')

# Regression: Craft bullet indentation must become semantic HTML lists.
def convert_fixture(name):
    return json.loads(subprocess.check_output(['/usr/bin/osascript', '-l', 'JavaScript', str(p / 'convert.js'), str(p / name)]))
r = convert_fixture('bullets.rtf')
assert r['html'].count('<ul>') == 1
assert r['html'].count('<li>') == 2
assert r['html'].count('<code ') == 3
assert '\t' not in r['html']
assert '<li><code ' in r['html']
assert r['plain'].count('\t') == 8
r = convert_fixture('nested.rtf')
assert r['html'].count('<ul>') == 2
assert r['html'].count('<li>') == 3
assert '</ul>\n</li>\n<li>' in r['html']
assert '- keep this code' in r['html']
assert '<br>After</div>' in r['html']
print('Bullet, nested-list, and code-marker regression checks passed.')

r = convert_fixture('bullets.rtf')
assert r['html'].startswith('<div><ul>\n<li><code ')
assert r['html'].endswith('</li>\n</ul></div>')
assert len(r['html'].splitlines()) == 4
assert '<code style="font-family:monospace;white-space:pre-wrap">None</code> is' in r['html']
print('Indented block HTML checks passed.')

# Check the exact requested wrapper layouts without touching the clipboard.
source = (p / 'convert.js').read_text()
source = source[:source.index('function run(argv)')]
examples = [
    ('<div><ul><li><code>1</code></li></ul></div>', '<div><ul>\n<li><code>1</code></li>\n</ul></div>'),
    ('<div><ul><li><code></code></li></ul><ul><li><code></code></li></ul></div>', '<div>\n<ul>\n<li><code></code></li>\n</ul>\n<ul>\n<li><code></code></li>\n</ul>\n</div>'),
]
for raw, expected in examples:
    script = source + '\nfunction run() { return formatBlocks(' + json.dumps(raw) + '); }'
    actual = subprocess.check_output(['/usr/bin/osascript', '-l', 'JavaScript', '-'], input=script.encode()).decode().rstrip('\n')
    assert actual == expected, actual
print('Both requested HTML layouts passed.')
