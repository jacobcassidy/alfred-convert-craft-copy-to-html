# Version 0.2.1 validation

## Automated evidence

The macOS JXA harness covers ten conversion groups and twenty workflow scenarios, plus three native-notification construction states, using RTF fixtures, AppKit attributed strings, isolated named pasteboards, simulated copy operations, and recording notifications. It does not read or alter the general clipboard, send real keys, or display notifications.

Checks cover semantic formatting combinations, bare code tags, escaped text and link destinations, rejected URL schemes, Unicode graphemes across style boundaries, CRLF/CR/LF offset alignment, nested bullets, monospace markers, code whitespace, and ordinary text around lists. The extended fixture and generated attributed inputs are synthetic test cases; additional real Craft captures remain part of live acceptance.

Clipboard checks inspect the prepared native item for exactly `public.utf8-plain-text`, then verify one item whose value equals the HTML source, with no HTML or RTF representation. Known system-generated plain-text aliases are accounted for separately. Missing, invalid, or empty RTF, conversion and preparation errors, modifier/permission/copy-timeout failures, focus changes at each boundary, newer clipboard contents, and a failed write are exercised. Revision assertions verify that preservation failures do not mutate any copied representation. Repeated invocation requires a fresh copy even after a previous HTML result.

Recorded notifications prove progress follows Craft validation and precedes modifier waiting, that success follows the output write, and that progress and terminal updates share one identity. All failures after progress replace it with a specific error and never report ready.

The Python runner checks the exact Control-Command-C binding, Craft restriction, pass-through modifier behavior, one nonconcurrent action, graph connections, retained bundle identifier, version, readme consistency, and exact package contents. Packaging is also tested in a temporary project without modifying the release bundle.

## Native platform checks

- Verified `/Applications/Craft.app/Contents/Info.plist`: `CFBundleIdentifier` is `com.lukilabs.lukiapp`.
- Verified Alfred's Related Apps plist format against its bundled Advanced Hotkeys example: bundle identifiers in `relatedApps` with `relatedAppsMode = 1` for app-specific execution. Alfred's [hotkey documentation](https://www.alfredapp.com/help/workflows/triggers/hotkey/) describes the focus restriction and modifier behavior menu.
- Diagnosed the 0.2.0 missing banners through notification-service logs: direct AppKit calls from `/usr/bin/osascript` were recorded as delivered, but macOS could not resolve `com.apple.osascript` as a notification source. Delivered-state inspection alone did not establish visible delivery. The user confirmed a Standard Additions test notification appeared.
- Version 0.2.1 builds `workflow/notify.js` into a background app named Craft HTML Notifications, with bundle identifier `local.jacob.craft-html-notifications`. The build uses stock macOS `osacompile` and `codesign`, includes both Intel and Apple silicon in the applet executable, and signs the app locally without an account. Tests verify its compiled source, bundle identity, background setting, signature, and packaged executable permissions.
- Exercised the exact packaged notification app through the production launcher after the user approved its notification permission. macOS recorded started and ready using the same request identifier, with `updatedExisting: true` for replacement. The frontmost process identifier stayed unchanged. System Settings listed the active helper with notification delivery enabled. The user confirmed a visible ready banner, and computer-use inspection observed “Conversion started.” in Notification Center. A rapid test displayed only the ready state to the user; a longer, separately inspected started state established visible progress. Native diagnostics verify replacement with the shared request identifier.
- The helper uses built-in `NSUserNotification.identifier`. Apple's [identifier documentation](https://developer.apple.com/documentation/foundation/nsusernotification/identifier) specifies replacement for a matching identity. The legacy API is deprecated but remains available in this macOS runtime. The helper receives only status text and an identifier; it does not access Craft content or the clipboard. Opening a notification without status arguments exits without repeating a copy.
- The user installed 0.2.0 and assigned Control-Command-C. Inspected Alfred's two-object workflow graph and confirmed Related Apps contains Craft with “have focus”. Alfred's debugger subsequently reported successful conversion. The user also observed Craft's copy confirmation. The 0.2.1 bundle is built for reimport; its new helper is present in the package.

## Live acceptance still pending

The user installed the initial refactor bundle and exercised the shortcut. The remaining clipboard-value/content checks require a nonprivate Craft selection approved for inspection; automatic approval review previously blocked reading the current document. No document content or general-clipboard data was accessed while diagnosing notifications.

The 0.2.1 helper's permission, visible started and ready messages, native identity replacement, and unchanged foreground process were checked. The user-installed workflow remains 0.2.0 until the updated bundle is imported. macOS notification settings, Focus, and the “when mirroring or sharing the display” preference can suppress visible delivery. Allow Craft HTML Notifications in System Settings → Notifications or its first-use permission prompt; repeat the shortcut after granting permission to see the full lifecycle.

With approval for the live checks, or manually:

1. Import the 0.2.1 bundle into Alfred and assign Control-Command-C if stripped. Inspect Related Apps: only while Craft has focus. Confirm “Pass through modifier keys (Fastest)” so the action can show progress before key release. Verify the graph contains exactly one hotkey and one action.
2. Select nonprivate representative Craft text containing combined styles, links, underline, Unicode, and lists. Hold the shortcut modifiers briefly and confirm immediate progress without focus change. Release them and confirm the same visible notification changes to ready, with one entry in Notification Center.
3. Paste into a plain-text editor and inspect literal tags. Check that the general pasteboard contains one explicitly published string representation and no retained HTML/RTF representation. Capture representative RTF examples for future regression tests with the content owner's approval.
4. Exercise a copy/focus failure after progress and confirm the same visible notification changes to the specific error. Trigger repeatedly during a run and verify Alfred does not start competing actions.
5. Reassign the shortcut, retaining Craft in Related Apps. With Craft running in the background, trigger from another app and confirm no copy, notification, or clipboard change. Invoke the action directly outside Craft and confirm runtime rejection. Repeat after importing an update.
6. Switch apps during copying and during conversion, test held modifiers and copy timeouts, and verify permission-error messages without granting or removing security permissions unless separately approved.

The automated and native notification-backend checks pass. The remaining end-to-end Craft acceptance checks after importing 0.2.1 remain explicitly unverified.
