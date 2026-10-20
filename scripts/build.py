import plistlib
import subprocess
import tempfile
import zipfile
from pathlib import Path

project = Path(__file__).resolve().parent.parent
workflow = project / "workflow"
dist = project / "dist"
dist.mkdir(exist_ok=True)
with (workflow / "info.plist").open("rb") as plist_file:
    version = plistlib.load(plist_file)["version"]
with tempfile.TemporaryDirectory() as temporary:
    helper = Path(temporary) / "Craft HTML Notifications.app"
    subprocess.run(
        [
            "/usr/bin/osacompile",
            "-l",
            "JavaScript",
            "-o",
            str(helper),
            str(workflow / "notify.js"),
        ],
        check=True,
    )
    metadata = helper / "Contents" / "Info.plist"
    info = plistlib.loads(metadata.read_bytes())
    info.update(
        CFBundleIdentifier="local.jacob.craft-html-notifications",
        CFBundleName="Craft HTML Notifications",
        CFBundleDisplayName="Craft HTML Notifications",
        CFBundleShortVersionString=version,
        CFBundleVersion=version,
        LSUIElement=True,
    )
    metadata.write_bytes(plistlib.dumps(info))
    # Re-sign after setting the app identity; no signing account is needed.
    subprocess.run(
        ["/usr/bin/codesign", "--force", "--sign", "-", str(helper)], check=True
    )
    with zipfile.ZipFile(
        dist / "convert-craft-copy-to-html.alfredworkflow", "w", zipfile.ZIP_DEFLATED
    ) as archive:
        for name in ("info.plist", "convert.js", "notify.js", "README.txt", "icon.png"):
            archive.write(workflow / name, name)
        for path in sorted(helper.rglob("*")):
            if path.is_file():
                archive.write(path, path.relative_to(helper.parent))
print(f"Built dist/convert-craft-copy-to-html.alfredworkflow v{version}")
