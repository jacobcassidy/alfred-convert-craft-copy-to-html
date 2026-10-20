from pathlib import Path
import plistlib
import zipfile
p = Path(__file__).resolve().parent
with (p / 'info.plist').open('rb') as plist_file:
    version = plistlib.load(plist_file)['version']
with zipfile.ZipFile(p / 'convert-craft-copy-to-html.alfredworkflow', 'w', zipfile.ZIP_DEFLATED) as archive:
    for name in ('info.plist', 'convert.js', 'README.txt', 'icon.png'):
        archive.write(p / name, name)
print(f'Built convert-craft-copy-to-html.alfredworkflow v{version}')
