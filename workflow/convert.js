/**
 * Craft selection to HTML source.
 * @file Copy fresh Craft RTF and publish one plain-text HTML fragment.
 */

/* exported run */

ObjC.import("AppKit");

const CRAFT_BUNDLE = "com.lukilabs.lukiapp";
const STARTED = "Conversion started.";
const READY = "HTML copy is ready to paste.";
const FOCUS_ERROR = "Focus changed. Select text in Craft and try again.";
const REVISION_ERROR = "Clipboard changed. Select text in Craft and try the shortcut again.";

/**
 * Escape HTML text and double-quoted attribute values.
 * @param {string} text Input text.
 * @returns {string} Escaped text.
 */
function escapeHTML(text) {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/**
 * Read semantic styling at a UTF-16 offset in an attributed string.
 * @param {object} attributed AppKit attributed string.
 * @param {number} offset UTF-16 offset.
 * @returns {object} Semantic style flags and an optional link.
 */
function styleAt(attributed, offset) {
  const attrs = attributed.attributesAtIndexEffectiveRange(offset, null);
  const font = attrs.objectForKey($.NSFontAttributeName);
  const traits = font.isNil() ? 0 : Number($.NSFontManager.sharedFontManager.traitsOfFont(font));
  const name = font.isNil() ? "" : ObjC.unwrap(font.fontName);
  const size = font.isNil() ? 0 : Number(font.pointSize);
  const link = attrs.objectForKey($.NSLinkAttributeName);

  /**
   * Check whether an attributed numeric decoration is enabled.
   * @param {object} key AppKit attribute name.
   * @returns {boolean} Whether the attribute is nonzero.
   */
  function enabled(key) {
    const value = attrs.objectForKey(key);

    return !value.isNil() && Number(value.integerValue) !== 0;
  }

  return {
    bold: !!(traits & 2),
    italic: !!(traits & 1),
    underline: enabled($.NSUnderlineStyleAttributeName),
    strike: enabled($.NSStrikethroughStyleAttributeName),
    code: !!(traits & 1024) || /mono|menlo|courier|consolas/i.test(name),
    heading: size >= 24 ? 1 : size >= 20 ? 2 : size >= 17 ? 3 : size >= 15 ? 4 : 0,
    link: link.isNil() ? "" : ObjC.unwrap(link.description),
  };
}

/**
 * Normalize line endings without shifting styles or splitting graphemes.
 * A grapheme spanning style boundaries uses the first character's style.
 * @param {object} attributed AppKit attributed string.
 * @returns {{text: string, styles: object[]}} Text and styles at normalized UTF-16 offsets.
 */
function parseAttributed(attributed) {
  const source = ObjC.unwrap(attributed.string);
  const styles = [];
  let text = "";
  let offset = 0;

  while (offset < source.length) {
    const range = attributed.string.rangeOfComposedCharacterSequenceAtIndex(offset);
    const length = source.slice(offset, offset + 2) === "\r\n" ? 2 : Number(range.length);
    const value = source.slice(offset, offset + length).replace(/\r\n|\r/g, "\n");
    const style = styleAt(attributed, offset);

    text += value;

    for (let index = 0; index < value.length; index++) {
      styles.push(style);
    }

    offset += length;
  }

  if (!text.trim()) throw new Error("Could not convert empty rich text. Select text in Craft and try again.");

  return { text, styles };
}

/**
 * Decode RTF into the serializer's normalized text model.
 * @param {object} data RTF NSData.
 * @returns {{text: string, styles: object[]}} Parsed content.
 */
function parseRTF(data) {
  const attributed = $.NSAttributedString.alloc.initWithRTFDocumentAttributes(data, null);

  if (!attributed || attributed.isNil())
    throw new Error("Could not read the rich text. Select text in Craft and try again.");

  return parseAttributed(attributed);
}

/**
 * Wrap escaped text in a deterministic order of semantic inline tags.
 * @param {string} text Unescaped text.
 * @param {object} style Semantic style flags.
 * @returns {string} Inline HTML.
 */
function renderInline(text, style) {
  let html = escapeHTML(text);

  if (style.code) html = "<code>" + html + "</code>";

  if (style.bold) html = "<strong>" + html + "</strong>";

  if (style.italic) html = "<em>" + html + "</em>";

  if (style.underline) html = "<u>" + html + "</u>";

  if (style.strike) html = "<s>" + html + "</s>";

  if (/^(https?:|mailto:)/i.test(style.link || "")) html = '<a href="' + escapeHTML(style.link) + '">' + html + "</a>";

  return html;
}

/**
 * Serialize normalized attributed text without reading the clipboard.
 * @param {{text: string, styles: object[]}} model Parsed text and styles.
 * @returns {string} One deterministic HTML fragment.
 */
function serialize(model) {
  const lines = [];
  let offset = 0;

  /**
   * Render contiguous equal styles within a single line.
   * @param {number} start Inclusive offset.
   * @param {number} end Exclusive offset.
   * @returns {string} Inline HTML for the range.
   */
  function renderRange(start, end) {
    let html = "";
    let cursor = start;

    while (cursor < end) {
      const style = model.styles[cursor];
      const signature = JSON.stringify(style);
      let next = cursor + 1;

      while (next < end && JSON.stringify(model.styles[next]) === signature) {
        next++;
      }

      html += renderInline(model.text.slice(cursor, next), style);
      cursor = next;
    }

    return html;
  }

  for (const line of model.text.split("\n")) {
    let marker = /^([ \t\u00a0]*)([-•◦▪‣])([ \t\u00a0]+)/.exec(line);
    const toggle = /^([ \t\u00a0]*)\+([ \t\u00a0]+)/.exec(line);

    if (marker && model.styles[offset + marker[1].length].code) marker = null;

    const isToggle = !!toggle && !model.styles[offset + toggle[1].length].code;
    const start = isToggle ? offset + toggle[1].length : offset;
    const titleStart = isToggle ? offset + toggle[0].length : start;
    let headingOffset = titleStart;

    while (headingOffset < offset + line.length && /[ \t\u00a0]/.test(model.text[headingOffset])) {
      headingOffset++;
    }

    lines.push({
      start: marker ? offset + marker[0].length : start,
      end: offset + line.length,
      bullet: !!marker,
      indent: marker ? marker[1].replace(/\t/g, "    ").length : 0,
      toggle: isToggle,
      titleStart,
      heading: model.styles[headingOffset]?.heading || 0,
    });
    offset += line.length + 1;
  }

  let cursor = 0;

  /**
   * Render consecutive bullet lines at one indentation level.
   * @param {number} indent Current list indentation.
   * @param {number} level HTML block indentation level.
   * @returns {string} List markup with two-space block indentation.
   */
  function renderList(indent, level) {
    const spaces = "  ".repeat(level);
    const childSpaces = "  ".repeat(level + 1);
    const items = [spaces + "<ul>"];

    while (cursor < lines.length && lines[cursor].bullet && lines[cursor].indent === indent) {
      const line = lines[cursor++];
      let item = childSpaces + "<li>" + renderRange(line.start, line.end);

      while (cursor < lines.length && lines[cursor].bullet && lines[cursor].indent > indent) {
        item += "\n" + renderList(lines[cursor].indent, level + 2);
      }

      if (item !== childSpaces + "<li>") {
        items.push(item + (item.includes("\n") ? "\n" + childSpaces : "") + "</li>");
      }
    }

    if (items.length === 1) return "";

    items.push(spaces + "</ul>");

    return items.join("\n");
  }

  const blocks = [];
  const hasBlocks = lines.some((line) => line.bullet || line.heading);

  while (cursor < lines.length) {
    if (lines[cursor].bullet) {
      const list = renderList(lines[cursor].indent, 0);

      if (list) blocks.push(list);
    } else {
      if (lines[cursor].heading) {
        const line = lines[cursor++];

        const title = renderRange(line.titleStart, line.end).replace(/<\/?strong>/g, "");

        blocks.push("<h" + line.heading + ">" + title + "</h" + line.heading + ">");

        continue;
      }

      const text = [];

      while (cursor < lines.length && !lines[cursor].bullet && !lines[cursor].heading) {
        const line = lines[cursor++];

        text.push(renderRange(line.start, line.end));
      }

      if (text.length === 1 && !renderRange(lines[cursor - 1].start, lines[cursor - 1].end)) continue;

      const content = text.join("<br>\n" + "  ".repeat(1));

      blocks.push(hasBlocks ? "<div>" + content + "</div>" : content);
    }
  }

  return hasBlocks
    ? "<div>\n" + blocks.join("\n").replace(/^/gm, "  ") + "\n</div>"
    : "<div>" + blocks.join("") + "</div>";
}

/**
 * Convert RTF into the sole output value.
 * @param {object} data RTF NSData.
 * @returns {string} HTML source.
 */
function convert(data) {
  return serialize(parseRTF(data));
}

/**
 * Require the original Craft process to remain frontmost.
 * @param {object} operations Injected platform operations.
 * @param {number} pid Original process identifier.
 */
function requireFocus(operations, pid) {
  const app = operations.frontmost();

  if (!app || app.bundle !== CRAFT_BUNDLE || app.pid !== pid) throw new Error(FOCUS_ERROR);
}

/**
 * Wait for key release, send Copy, and require a fresh clipboard revision.
 * @param {object} pasteboard Clipboard to inspect.
 * @param {object} operations Injected focus, time, modifiers, and copy operations.
 * @param {number} pid Original Craft process identifier.
 */
function copySelection(pasteboard, operations, pid) {
  let deadline = operations.now() + 3000;

  while (operations.modifiersHeld()) {
    requireFocus(operations, pid);

    if (operations.now() >= deadline) throw new Error("Release the shortcut keys and try again.");

    operations.pause();
  }

  requireFocus(operations, pid);

  const revision = Number(pasteboard.changeCount);

  try {
    operations.sendCopy();
  } catch {
    throw new Error(
      "Copy could not run. Allow Alfred in macOS Privacy & Security > Accessibility and allow System Events automation.",
    );
  }

  deadline = operations.now() + 2500;

  while (Number(pasteboard.changeCount) === revision) {
    requireFocus(operations, pid);

    if (operations.now() >= deadline)
      throw new Error(
        "No new copy detected. Select text in Craft and try again; existing clipboard was not converted.",
      );

    operations.pause();
  }

  requireFocus(operations, pid);
}

/**
 * Capture fresh RTF and its revision without modifying the pasteboard.
 * @param {object} pasteboard Source pasteboard.
 * @returns {{revision: number, data: object}} Captured RTF.
 */
function readInput(pasteboard) {
  const revision = Number(pasteboard.changeCount);
  const data = pasteboard.dataForType($.NSPasteboardTypeRTF);

  if (!data || data.isNil()) throw new Error("Select formatted text in Craft and try the shortcut again.");

  if (Number(pasteboard.changeCount) !== revision) throw new Error(REVISION_ERROR);

  return { revision, data };
}

/**
 * Prepare exactly one explicitly declared plain-text representation.
 * @param {string} html HTML source to publish.
 * @returns {object} Prepared pasteboard item.
 */
function prepareOutput(html) {
  const item = $.NSPasteboardItem.alloc.init;

  if (!item || item.isNil() || !item.setStringForType(html, $.NSPasteboardTypeString)) {
    throw new Error("Could not prepare HTML for the clipboard. Clipboard unchanged.");
  }

  return item;
}

/**
 * Publish a prepared item after the final focus and revision checks.
 * @param {object} pasteboard Destination pasteboard.
 * @param {number} revision Expected input revision.
 * @param {object} item Prepared plain-text item.
 * @param {object} operations Platform operations.
 * @param {number} pid Original Craft process.
 */
function writeOutput(pasteboard, revision, item, operations, pid) {
  const items = $.NSArray.arrayWithObject(item);

  requireFocus(operations, pid);

  if (Number(pasteboard.changeCount) !== revision) throw new Error(REVISION_ERROR);

  pasteboard.clearContents;

  if (!pasteboard.writeObjects(items))
    throw new Error("Could not write HTML to the clipboard. The clipboard may now be empty; try again in Craft.");
}

/**
 * Execute the only production flow with injectable side effects for tests.
 * @param {object} pasteboard Pasteboard to copy into and replace.
 * @param {object} operations Platform operations, including conversion and preparation.
 * @param {object} notifications Notification adapter with show and finish operations.
 * @returns {string} Terminal status, also sent to the notification adapter after start.
 */
function execute(pasteboard, operations, notifications) {
  const app = operations.frontmost();
  const identity = "craft-html-" + operations.identity();

  if (!app || app.bundle !== CRAFT_BUNDLE) return "Select text in the native Craft app and press Control-Command-C.";

  let started = false;

  try {
    notifications.show(identity, STARTED);
    started = true;
    copySelection(pasteboard, operations, app.pid);

    const input = readInput(pasteboard);
    const html = operations.convert(input.data);
    const item = operations.prepare(html);

    writeOutput(pasteboard, input.revision, item, operations, app.pid);
    notifications.finish(identity, READY);

    return READY;
  } catch (error) {
    const message = error.message || String(error);

    if (started) notifications.finish(identity, message);

    return message;
  }
}

/**
 * Provide native operations without activating any app.
 * @returns {object} Operations used by the workflow action.
 */
function nativeOperations() {
  return {
    /** @returns {object|null} Frontmost app identity. */
    frontmost() {
      const app = $.NSWorkspace.sharedWorkspace.frontmostApplication;

      return app.isNil() ? null : { bundle: ObjC.unwrap(app.bundleIdentifier), pid: Number(app.processIdentifier) };
    },

    /** @returns {boolean} Whether shortcut modifiers remain held. */
    modifiersHeld() {
      return (Number($.NSEvent.modifierFlags) & 1966080) !== 0;
    },

    /** Send ordinary Command-C through System Events. */
    sendCopy() {
      Application("System Events").keyCode(8, { using: ["command down"] });
    },

    /** @returns {number} Current time in milliseconds. */
    now() {
      return Date.now();
    },

    /** Yield while waiting for modifier release or a fresh copy. */
    pause() {
      delay(0.025);
    },

    /** @returns {string} Unique notification identity for this run. */
    identity() {
      return ObjC.unwrap($.NSUUID.UUID.UUIDString);
    },

    convert,
    prepare: prepareOutput,
  };
}

/**
 * Launch the bundled notification app in the background and await delivery.
 * @param {string} identity Stable identifier for this conversion.
 * @param {string} message Status text to display.
 */
function runNotificationHelper(identity, message) {
  const path = ObjC.unwrap($.NSFileManager.defaultManager.currentDirectoryPath) + "/Craft HTML Notifications.app";
  const task = $.NSTask.alloc.init;
  const errors = $.NSPipe.pipe;

  if (!$.NSFileManager.defaultManager.fileExistsAtPath(path)) {
    throw new Error("Notification helper missing. Reinstall the latest workflow bundle.");
  }

  task.launchPath = "/usr/bin/open";
  task.arguments = $(["-g", "-j", "-n", "-W", path, "--args", identity, message]);
  task.standardError = errors;
  task.launch;
  task.waitUntilExit;

  if (Number(task.terminationStatus) !== 0)
    throw new Error("Could not launch Craft HTML Notifications. Reinstall the workflow bundle and try again.");
}

/**
 * Give progress and completion separate identities so each can show a banner.
 * @param {Function} deliver Background helper launcher, injectable for tests.
 * @returns {object} Adapter that posts a started banner and a separate result.
 */
function nativeNotifications(deliver = runNotificationHelper) {
  return {
    /**
     * Post immediate progress for this conversion.
     * @param {string} identity Conversion identifier.
     * @param {string} message Progress text.
     */
    show(identity, message) {
      deliver(identity + "-started", message);
    },

    /**
     * Post a separate ready or failure notification after progress.
     * @param {string} identity Conversion identifier.
     * @param {string} message Terminal status text.
     */
    finish(identity, message) {
      deliver(identity + "-finished", message);
    },
  };
}

/**
 * Run the shortcut action with no flags, fixtures, or alternate input paths.
 * @returns {string} Human-readable status for Alfred's debugger.
 */
function run() {
  return execute($.NSPasteboard.generalPasteboard, nativeOperations(), nativeNotifications());
}
