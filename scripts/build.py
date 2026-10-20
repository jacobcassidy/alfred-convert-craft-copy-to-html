from pathlib import Path
import plistlib
import zipfile

project = Path(__file__).resolve().parent.parent
workflow = project / 'workflow'
with (workflow / 'info.plist').open('rb') as plist_file:
    version = plistlib.load(plist_file)['version']
with zipfile.ZipFile(project / 'convert-craft-copy-to-html.alfredworkflow', 'w', zipfile.ZIP_DEFLATED) as archive:
    for name in ('info.plist', 'convert.js', 'README.txt', 'icon.png'):
        archive.write(workflow / name, name)
print(f'Built convert-craft-copy-to-html.alfredworkflow v{version}')
