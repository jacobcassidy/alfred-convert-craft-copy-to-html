from pathlib import Path
import plistlib
import zipfile

project = Path(__file__).resolve().parent.parent
workflow = project / 'workflow'
dist = project / 'dist'
dist.mkdir(exist_ok=True)
with (workflow / 'info.plist').open('rb') as plist_file:
    version = plistlib.load(plist_file)['version']
with zipfile.ZipFile(dist / 'convert-craft-copy-to-html.alfredworkflow', 'w', zipfile.ZIP_DEFLATED) as archive:
    for name in ('info.plist', 'convert.js', 'README.txt', 'icon.png'):
        archive.write(workflow / name, name)
print(f'Built dist/convert-craft-copy-to-html.alfredworkflow v{version}')
