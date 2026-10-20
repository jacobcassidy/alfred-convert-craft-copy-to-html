"""Check native JXA conversion, isolated clipboard behavior, and Alfred wiring."""

import json
import plistlib
import subprocess
import tempfile
import zipfile
from pathlib import Path

project = Path(__file__).resolve().parent.parent
workflow = project / "workflow"
source = (workflow / "convert.js").read_text()
harness = (project / "tests" / "harness.js").read_text()

with tempfile.NamedTemporaryFile(mode="w", suffix=".js") as script:
    script.write(source + "\n" + harness)
    script.flush()
    result = json.loads(
        subprocess.check_output(
            ["/usr/bin/osascript", "-l", "JavaScript", script.name, str(project)],
            text=True,
        )
    )
print(f"Native JXA checks passed: {result}")

info = plistlib.loads((workflow / "info.plist").read_bytes())
objects = {obj["uid"]: obj for obj in info["objects"]}
assert len(objects) == len(info["objects"]) == 2
assert objects["copy-hotkey"]["type"] == "alfred.workflow.trigger.hotkey"
assert objects["convert"]["type"] == "alfred.workflow.action.script"
hotkey = objects["copy-hotkey"]["config"]
assert hotkey["hotkey"] == 8 and hotkey["hotmod"] == 1310720
assert hotkey["relatedAppsMode"] == 1
assert hotkey["relatedApps"] == ["com.lukilabs.lukiapp"]
assert hotkey["modsmode"] == 2  # Pass modifiers through; runtime waits after progress.
assert hotkey["argument"] == 0
action = objects["convert"]["config"]
assert action["concurrently"] is False
assert action["script"] == '/usr/bin/osascript -l JavaScript "./convert.js"'
assert list(info["connections"]) == ["copy-hotkey"]
assert len(info["connections"]["copy-hotkey"]) == 1
assert info["connections"]["copy-hotkey"][0]["destinationuid"] == "convert"
assert set(info["uidata"]) == set(objects)
assert info["bundleid"] == "local.jacob.craft-to-anki"
assert info["version"] == "0.2.9"
assert info["readme"] == (workflow / "README.txt").read_text()
assert "--copy" not in source
assert "NSPasteboardTypeHTML" not in source
assert source.count("setStringForType(") == 1
print("Single-path Craft-only Alfred wiring checks passed.")

with tempfile.TemporaryDirectory() as temp:
    # Run the real builder in an isolated project so checks do not modify dist/.
    sandbox = Path(temp)
    (sandbox / "scripts").mkdir()
    (sandbox / "workflow").symlink_to(workflow, target_is_directory=True)
    builder = sandbox / "scripts" / "build.py"
    builder.write_bytes((project / "scripts" / "build.py").read_bytes())
    # The builder resolves its own path; the workflow symlink remains a source.
    subprocess.run(["python3", str(builder)], check=True)
    bundle = sandbox / "dist" / "convert-craft-copy-to-html.alfredworkflow"
    with zipfile.ZipFile(bundle) as archive:
        names = {"info.plist", "convert.js", "notify.m", "README.txt", "icon.png"}
        packaged = set(archive.namelist())
        helper = "Craft HTML Notifications.app/"
        assert {name for name in packaged if not name.startswith(helper)} == names
        assert all(not name.startswith("docs/") for name in packaged)
        helper_info = plistlib.loads(archive.read(helper + "Contents/Info.plist"))
        assert (
            helper_info["CFBundleIdentifier"] == "local.jacob.craft-html-notifications"
        )
        assert helper_info["LSUIElement"] is True
        assert helper_info["CFBundleVersion"] == info["version"]
        # A native host must replace the script applet entirely: Control can force
        # an applet startup screen even with OSAAppletShowStartupScreen disabled.
        assert helper_info["CFBundleExecutable"] == "notifier"
        assert "OSAAppletShowStartupScreen" not in helper_info
        assert not any("/Scripts/" in name for name in packaged)
        executable = archive.getinfo(helper + "Contents/MacOS/notifier")
        assert executable.external_attr >> 16 & 0o111
        archive.extractall(sandbox / "unpacked")
        helper_path = sandbox / "unpacked" / helper
        subprocess.run(["/usr/bin/codesign", "--verify", str(helper_path)], check=True)
        native_binary = helper_path / "Contents/MacOS/notifier"
        native_binary.chmod(0o755)
        # Opening the helper with no status arguments exits without AppKit UI
        # or delivery. This test sends no notifications and reads no clipboard.
        subprocess.run([str(native_binary)], timeout=5, check=True)
        architectures = subprocess.check_output(
            ["/usr/bin/lipo", "-archs", str(native_binary)], text=True
        )
        assert {"arm64", "x86_64"} <= set(architectures.split())
        for name in names:
            assert archive.read(name) == (workflow / name).read_bytes()
print("Replacement package contents checked without modifying dist/.")
