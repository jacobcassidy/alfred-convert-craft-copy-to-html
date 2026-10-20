/**
 * Craft rich-text conversion.
 * @file Convert Craft rich text into HTML and preserve clipboard formats for pasting into Anki.
 */

/* exported run */

ObjC.import("AppKit");

/**
 * Escape text for HTML content and attribute values.
 * @param {string} value Text to escape.
 * @returns {string} HTML-safe text.
 */
function escapeHTML(value) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/**
 * Keep inline markup together and separate block boundaries with newlines.
 * A div with one block child shares that child's boundary lines.
 * @param {string} html Generated HTML to format.
 * @returns {string} HTML with formatted block boundaries.
 */
function formatBlocks(html) {
  const root = { children: [] };
  const stack = [root];

  /**
   * Append a block tag or inline text token to the block tree.
   * @param {string} token HTML token to append.
   */
  function appendToken(token) {
    if (!token) return;

    const match = /^<(div|ul|li)>$/.exec(token);

    if (match) {
      const node = { tag: match[1], children: [] };
      stack[stack.length - 1].children.push(node);
      stack.push(node);
    } else if (/^<\/(div|ul|li)>$/.test(token)) {
      stack.pop();
    } else {
      stack[stack.length - 1].children.push(token);
    }
  }

  html.split(/(<\/?(?:div|ul|li)>)/g).forEach(appendToken);

  /**
   * Identify block children in the parsed tree.
   * @param {object|string} child Parsed child node or inline text.
   * @returns {boolean} Whether the child is a block node.
   */
  function isBlock(child) {
    return typeof child !== "string";
  }

  /**
   * Render a parsed node with shared or separate block boundary lines.
   * @param {object|string} node Parsed node or inline text.
   * @returns {string} Formatted HTML for the node.
   */
  function render(node) {
    if (typeof node === "string") return node;
    const children = node.children;
    const body = children.map(render);
    if (!node.tag) return body.join("");
    const open = "<" + node.tag + ">";
    const close = "</" + node.tag + ">";
    const blocks = children.filter(isBlock);
    if (!blocks.length) return open + body.join("") + close;
    if (node.tag === "div" && children.length === 1) return open + body[0] + close;
    return open + "\n" + body.join("\n") + "\n" + close;
  }

  return render(root);
}

/**
 * Convert RTF data into HTML while retaining its plain text.
 * @param {object} data AppKit NSData containing RTF.
 * @returns {{html: string, plain: string}} Clipboard representations of the rich text.
 */
function convert(data) {
  const attributed = $.NSAttributedString.alloc.initWithRTFDocumentAttributes(data, null);

  if (!attributed || attributed.isNil()) throw new Error("Could not read the rich text.");

  const plain = ObjC.unwrap(attributed.string);
  const styles = [];
  let html = "";
  let previous = null;
  let buffer = "";

  /**
   * Append buffered text with its inline styles to the HTML output.
   */
  function flush() {
    if (!buffer) return;

    let text = escapeHTML(buffer).replace(/\r\n|\r|\n/g, "<br>");

    if (previous.code) text = '<code style="font-family:monospace;white-space:pre-wrap">' + text + "</code>";

    if (previous.bold) text = "<b>" + text + "</b>";

    if (previous.italic) text = "<i>" + text + "</i>";

    if (previous.underline) text = "<u>" + text + "</u>";

    if (previous.strike) text = "<s>" + text + "</s>";

    if (previous.link && /^(https?:|mailto:)/i.test(previous.link))
      text = '<a href="' + escapeHTML(previous.link) + '">' + text + "</a>";

    html += text;
    buffer = "";
  }

  for (let i = 0; i < attributed.length; i++) {
    const attrs = attributed.attributesAtIndexEffectiveRange(i, null);
    const font = attrs.objectForKey($.NSFontAttributeName);
    const traits = font.isNil() ? 0 : Number($.NSFontManager.sharedFontManager.traitsOfFont(font));
    const name = font.isNil() ? "" : ObjC.unwrap(font.fontName);

    /**
     * Check whether a numeric text attribute is enabled.
     * @param {object} key AppKit attribute key.
     * @returns {boolean} Whether the attribute has a nonzero value.
     */
    function has(key) {
      const value = attrs.objectForKey(key);
      return !value.isNil() && Number(value.integerValue) !== 0;
    }

    const link = attrs.objectForKey($.NSLinkAttributeName);

    const style = {
      code: !!(traits & 1024) || /mono|menlo|courier|consolas/i.test(name),
      bold: !!(traits & 2),
      italic: !!(traits & 1),
      underline: has($.NSUnderlineStyleAttributeName),
      strike: has($.NSStrikethroughStyleAttributeName),
      link: link.isNil() ? "" : ObjC.unwrap(link.description),
    };

    styles.push(style);
  }

  /**
   * Render a range of characters with their recorded inline styles.
   * @param {number} start Inclusive character offset.
   * @param {number} end Exclusive character offset.
   * @returns {string} Styled HTML for the range.
   */
  function renderRange(start, end) {
    html = "";
    previous = null;
    buffer = "";

    for (let index = start; index < end; index++) {
      const style = styles[index];

      if (JSON.stringify(style) !== JSON.stringify(previous)) {
        flush();
        previous = style;
      }

      buffer += plain.charAt(index);
    }

    flush();

    return html;
  }

  const lines = [];
  let offset = 0;

  /**
   * Record line boundaries and bullet indentation within the plain text.
   * @param {string} line Plain-text line to inspect.
   */
  function recordLine(line) {
    let match = /^([ \t\u00a0]*)([-•◦▪‣])([ \t\u00a0]+)/.exec(line);

    // A marker inside a monospace run is code, not a list item.
    if (match && styles[offset + match[1].length].code) match = null;

    lines.push({
      start: offset,
      end: offset + line.length,
      bullet: !!match,
      indent: match ? match[1].replace(/\t/g, "    ").length : 0,
      content: offset + (match ? match[0].length : 0),
    });

    offset += line.length;

    if (plain.substr(offset, 2) === "\r\n") offset += 2;
    else if (offset < plain.length) offset++;
  }

  plain.split(/\r\n|\r|\n/).forEach(recordLine);

  /**
   * Identify lines that begin with a bullet marker outside monospace text.
   * @param {object} line Recorded line metadata.
   * @returns {boolean} Whether the line is a bullet item.
   */
  function isBullet(line) {
    return line.bullet;
  }

  if (!lines.some(isBullet)) {
    html = renderRange(0, plain.length);
  } else {
    let cursor = 0;

    /**
     * Render consecutive bullet lines and their nested lists.
     * @param {number} indent Indentation shared by items in this list.
     * @returns {string} HTML for the list.
     */
    function renderList(indent) {
      let output = "<ul>";

      while (cursor < lines.length && lines[cursor].bullet && lines[cursor].indent === indent) {
        const line = lines[cursor++];

        output += "<li>" + renderRange(line.content, line.end);

        while (cursor < lines.length && lines[cursor].bullet && lines[cursor].indent > indent) {
          output += renderList(lines[cursor].indent);
        }

        output += "</li>";
      }

      return output + "</ul>";
    }

    const blocks = [];

    while (cursor < lines.length) {
      if (lines[cursor].bullet) blocks.push(renderList(lines[cursor].indent));
      else {
        const textLines = [];

        while (cursor < lines.length && !lines[cursor].bullet) {
          const line = lines[cursor++];
          textLines.push(renderRange(line.start, line.end));
        }

        if (textLines.join("")) blocks.push("<div>" + textLines.join("<br>") + "</div>");
      }
    }

    html = blocks.join("");
  }

  // Normal block whitespace prevents source indentation from adding visible gaps.
  return { html: formatBlocks("<div>" + html + "</div>"), plain: plain };
}

/**
 * Copy the current Craft selection after the shortcut modifiers are released.
 * @returns {string|null} Failure message, or null after a successful copy.
 */
function copyFromCraft() {
  const pb = $.NSPasteboard.generalPasteboard;
  const app = $.NSWorkspace.sharedWorkspace.frontmostApplication;

  if (!/^Craft$/i.test(ObjC.unwrap(app.localizedName))) {
    return "Select text in Craft, then press Option-Command-C.";
  }

  const pid = app.processIdentifier;

  // Wait for the trigger keys to be released before sending ordinary Command-C.
  let deadline = Date.now() + 3000;

  while ((Number($.NSEvent.modifierFlags) & 1966080) !== 0) {
    if (Date.now() > deadline) return "Release the shortcut keys and try again.";
    delay(0.025);
  }

  if ($.NSWorkspace.sharedWorkspace.frontmostApplication.processIdentifier !== pid) {
    return "Focus changed. Select text in Craft and try again.";
  }

  const revision = pb.changeCount;

  try {
    Application("System Events").keyCode(8, { using: ["command down"] });
  } catch {
    return "Copy could not run. Allow Alfred in macOS Privacy & Security > Accessibility and allow System Events automation if prompted.";
  }

  deadline = Date.now() + 2500;

  while (pb.changeCount === revision) {
    if (Date.now() > deadline)
      return "No new copy detected. Select text in Craft and try again; existing clipboard was not converted.";

    delay(0.025);
  }

  if ($.NSWorkspace.sharedWorkspace.frontmostApplication.processIdentifier !== pid) {
    return "Focus changed during copying. Please try again in Craft.";
  }

  return null;
}

/**
 * Convert a test RTF file or the clipboard, optionally copying from Craft first.
 * @param {string[]} argv Workflow arguments or a test fixture path.
 * @returns {string} Conversion JSON or a user-facing status message.
 */
function main(argv) {
  if (argv[0] === "--copy") {
    const problem = copyFromCraft();
    if (problem) return problem;
    argv = [];
  }

  // File mode is for testing only; it never reads or changes the clipboard.
  if (argv.length) {
    const data = $.NSData.dataWithContentsOfFile(argv[0]);
    if (data.isNil()) throw new Error("Cannot read test file.");
    return JSON.stringify(convert(data));
  }

  const pb = $.NSPasteboard.generalPasteboard;
  const revision = pb.changeCount;
  const rtf = pb.dataForType($.NSPasteboardTypeRTF);

  if (rtf.isNil()) return "Copy formatted text directly from Craft first. Clipboard unchanged.";

  const result = convert(rtf);
  const item = $.NSPasteboardItem.alloc.init;

  item.setStringForType(result.html, $.NSPasteboardTypeHTML);
  item.setStringForType(result.plain, $.NSPasteboardTypeString);
  item.setDataForType(rtf, $.NSPasteboardTypeRTF);

  if (pb.changeCount !== revision) return "Clipboard changed during conversion. Please try again.";

  pb.clearContents;

  if (!pb.writeObjects($.NSArray.arrayWithObject(item))) throw new Error("Could not write the clipboard.");

  return "Ready! Paste into Anki with Command-V.";
}

/**
 * Run the Alfred entry point and turn conversion failures into status messages.
 * @param {string[]} argv Arguments supplied by osascript.
 * @returns {string} Conversion output or a user-facing error message.
 */
function run(argv) {
  try {
    return main(argv);
  } catch (error) {
    return "Convert Craft Copy to HTML: " + error.message;
  }
}
