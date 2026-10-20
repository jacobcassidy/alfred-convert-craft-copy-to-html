from pathlib import Path
import zipfile
p = Path(__file__).resolve().parent
with zipfile.ZipFile(p / 'convert-craft-copy-to-html.alfredworkflow', 'w', zipfile.ZIP_DEFLATED) as archive:
    for name in ('info.plist', 'convert.js', 'README.txt', 'icon.png'):
        archive.write(p / name, name)
print('Built convert-craft-copy-to-html.alfredworkflow')
