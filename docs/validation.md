# Version 0.2.0 validation

## Automated evidence

The macOS JXA harness covers ten conversion groups and twenty workflow scenarios using RTF fixtures, AppKit attributed strings, isolated named pasteboards, simulated copy operations, and recording notifications. It does not read or alter the general clipboard, send real keys, or display notifications.

Checks cover semantic formatting combinations, bare code tags, escaped text and link destinations, rejected URL schemes, Unicode graphemes across style boundaries, CRLF/CR/LF offset alignment, nested bullets, monospace markers, code whitespace, and ordinary text around lists. The extended fixture and generated attributed inputs are synthetic test cases; additional real Craft captures remain part of live acceptance.

Clipboard checks inspect the prepared native item for exactly `public.utf8-plain-text`, then verify one item whose value equals the HTML source, with no HTML or RTF representation. Known system-generated plain-text aliases are accounted for separately. Missing, invalid, or empty RTF, conversion and preparation errors, modifier/permission/copy-timeout failures, focus changes at each boundary, newer clipboard contents, and a failed write are exercised. Revision assertions verify that preservation failures do not mutate any copied representation. Repeated invocation requires a fresh copy even after a previous HTML result.

Recorded notifications prove progress follows Craft validation and precedes modifier waiting, that success follows the output write, and that progress and terminal updates share one identity. All failures after progress replace it with a specific error and never report ready.

The Python runner checks the exact Control-Command-C binding, Craft restriction, pass-through modifier behavior, one nonconcurrent action, graph connections, retained bundle identifier, version, readme consistency, and exact package contents. Packaging is also tested in a temporary project without modifying the release bundle.

## Native platform checks

- Verified `/Applications/Craft.app/Contents/Info.plist`: `CFBundleIdentifier` is `com.lukilabs.lukiapp`.
- Verified Alfred's Related Apps plist format against its bundled Advanced Hotkeys example: bundle identifiers in `relatedApps` with `relatedAppsMode = 1` for app-specific execution. Alfred's [hotkey documentation](https://www.alfredapp.com/help/workflows/triggers/hotkey/) describes the focus restriction and modifier behavior menu.
- Exercised the actual production notification adapter against macOS Notification Center after allowing the requested osascript notification permission. Reading delivered notifications after each transition returned exactly one matching identity with `Conversion started.`, then `HTML copy is ready to paste.`, then a test failure message. The frontmost process identifier stayed unchanged.
- The adapter uses built-in `NSUserNotification.identifier`. Apple's [identifier documentation](https://developer.apple.com/documentation/foundation/nsusernotification/identifier) specifies replacement for a matching identity. This legacy AppKit API is deprecated but available in the tested macOS runtime; no third-party notification helper or compiled app is required.
- Opened the generated 0.2.0 bundle's Alfred import preview and confirmed its version, description, and readme. Alfred warns that imported hotkeys are stripped, so the installation instructions explain reassignment while retaining the Craft restriction.

## Live acceptance still pending

Automatic approval review blocked installing the built workflow into Alfred and inspecting the current Craft document because those actions change persistent app configuration or may reveal private document content. The reviewable bundle is `dist/convert-craft-copy-to-html.alfredworkflow`; it has not been installed by this refactor task.

Visible notification-banner replacement has not been confirmed. The native delivered-notification state was verified, but computer-use inspection could not expose its banner. macOS notification settings, Focus, and the “when mirroring or sharing the display” preference can suppress visible delivery; the installation guidance documents these prerequisites.

With approval for the live checks, or manually:

1. Import the 0.2.0 bundle into Alfred and assign Control-Command-C if stripped. Inspect Related Apps: only while Craft has focus. Confirm “Pass through modifier keys (Fastest)” so the action can show progress before key release. Verify the graph contains exactly one hotkey and one action.
2. Select nonprivate representative Craft text containing combined styles, links, underline, Unicode, and lists. Hold the shortcut modifiers briefly and confirm immediate progress without focus change. Release them and confirm the same visible notification changes to ready, with one entry in Notification Center.
3. Paste into a plain-text editor and inspect literal tags. Check that the general pasteboard contains one explicitly published string representation and no retained HTML/RTF representation. Capture representative RTF examples for future regression tests with the content owner's approval.
4. Exercise a copy/focus failure after progress and confirm the same visible notification changes to the specific error. Trigger repeatedly during a run and verify Alfred does not start competing actions.
5. Reassign the shortcut, retaining Craft in Related Apps. With Craft running in the background, trigger from another app and confirm no copy, notification, or clipboard change. Invoke the action directly outside Craft and confirm runtime rejection. Repeat after importing an update.
6. Switch apps during copying and during conversion, test held modifiers and copy timeouts, and verify permission-error messages without granting or removing security permissions unless separately approved.

The automated and native backend checks pass; these live acceptance checks remain explicitly unverified.
