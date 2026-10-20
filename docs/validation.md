# Workflow validation

## Automated evidence

The macOS JXA harness covers ten conversion groups, twenty workflow scenarios, and four notification-adapter states. It uses RTF fixtures, AppKit attributed strings, isolated named pasteboards, simulated copy operations, and recording notifications. It does not read or alter the general clipboard, send real keys, or display notifications.

Conversion checks cover combined semantic styles, bare code tags, escaping, allowed and disallowed links, Unicode graphemes, CRLF/CR/LF offsets and line formatting, nested bullets, monospace markers, whitespace, empty block removal, toggle markers, heading-sized text, and ordinary text around lists. Clipboard checks verify one item with exactly one explicitly declared plain-text representation containing the HTML source. Known system-generated aliases are accounted for separately.

Failure checks cover missing/invalid/empty RTF, conversion and preparation errors, held modifiers, denied or stale copies, focus changes before Copy, clipboard revision changes, failed writes, and repeated invocation. Simulated focus changes after Copy confirm processing continues. Preservation assertions check both contents and revision. Success is reported only after writing the HTML source.

Workflow scenarios use the production notification adapter with an injected recorder. They verify that started follows Craft validation and precedes modifier waiting, that ready follows a successful write, and that errors never report ready. Started uses the run identifier plus `-started`; ready or failure uses the same run identifier plus `-finished`. Both remain separate notifications. Adapter tests cover distinct identities for successful and failed runs.

The Python runner checks the exact Control-Command-C binding, Craft restriction, one nonconcurrent action, graph connections, retained bundle identifier, version, and readme consistency. It builds an isolated package and checks source contents, the native helper's app identity, workflow icon, signature, Intel/Apple silicon architectures, executable permissions, and absence of script-applet resources. Opening the helper without arguments exits promptly without initializing AppKit or showing UI.

## Native platform evidence

- Craft's installed bundle identifier is `com.lukilabs.lukiapp`. The installed Alfred graph has one hotkey and one action; Related Apps contains Craft with “have focus”. Alfred's debugger has reported successful conversion after the user triggered the shortcut.
- Direct AppKit notification delivery from osascript did not provide a recognized notification source. The native background app named Craft HTML Notifications supplies that identity. The user approved its permission, and visible started and ready messages were observed in earlier notification-only checks.
- The native host replaced the script applet in 0.2.2 to eliminate its Control-triggered Run/Quit startup screen. An isolated native-host test sent both statuses and exited with foreground focus unchanged. Automated key holding did not set the modifier flags read by AppKit, so physical held-Control acceptance remains a manual check.
- The user reported that 0.2.2 showed started as a banner but updated ready only in Notification Center. At the user's request, 0.2.3 gives started and the result different identifiers. The native host and notification permission identity remain unchanged.

The builder uses Apple's Xcode Command Line Tools and local ad-hoc signing. The prebuilt workflow requires no developer tools or third-party runtime dependencies. The notification helper receives only status text and an identifier; it does not read Craft documents or the clipboard.

## Live acceptance

After importing 0.2.11:

1. Restore Control-Command-C if Alfred clears it. Keep Related Apps restricted to Craft and the modifier behavior set to “Pass through modifier keys (Fastest)”.
2. Select nonprivate formatted content in Craft, trigger the shortcut, and release the keys. Confirm a started notification followed by a separate ready notification, with Craft remaining active. A failed run must post a separate failure notification.
3. Paste into a plain-text editor and verify literal HTML tags. Confirm one explicitly published string representation and no retained HTML or RTF representation. Content inspection requires the user's approval; previous automatic review blocked access to the current private Craft document.
4. Test held modifiers, focus changes, copy timeouts, repeated shortcuts, reassignment, and triggering outside Craft. Check that the native helper never shows a script Run/Quit dialog.

Allow Craft HTML Notifications in System Settings → Notifications or its first-use prompt. Banners, Focus, and screen-sharing preferences control visible delivery. The remaining end-to-end Craft acceptance checks after importing 0.2.3 require manual verification.
