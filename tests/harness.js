/**
 * JXA conversion and workflow checks.
 * @file Exercise native RTF and isolated pasteboards with simulated automation.
 */

/* global CRAFT_BUNDLE, STARTED, READY, convert, parseAttributed, prepareOutput, execute, serialize, nativeNotifications */
/* exported run */

/**
 * Fail the harness when a contract is not satisfied.
 * @param {boolean} value Assertion condition.
 * @param {string} message Failure description.
 */
function assert(value, message) {
  if (!value) throw new Error(message);
}

/**
 * Compare serializable values.
 * @param {*} actual Observed value.
 * @param {*} expected Expected value.
 * @param {string} message Failure description.
 */
function equal(actual, expected, message) {
  assert(JSON.stringify(actual) === JSON.stringify(expected), message + ": " + JSON.stringify(actual));
}

/**
 * Create an attributed string with a consistent ordinary font.
 * @param {string} text Content.
 * @returns {object} Mutable attributed string.
 */
function attributedText(text) {
  const value = $.NSMutableAttributedString.alloc.init;

  value.mutableString.setString(text);

  value.addAttributeValueRange(
    $.NSFontAttributeName,
    $.NSFont.fontWithNameSize("Helvetica", 12),
    $.NSMakeRange(0, value.length),
  );

  return value;
}

/**
 * Encode an attributed string into actual AppKit RTF data.
 * @param {object} value Attributed text.
 * @returns {object} RTF NSData.
 */
function rtfData(value) {
  return value.RTFFromRangeDocumentAttributes($.NSMakeRange(0, value.length), $.NSDictionary.dictionary);
}

/**
 * Read the sole plain-text value from a pasteboard.
 * @param {object} pasteboard Isolated pasteboard.
 * @returns {string|null} Published text.
 */
function clipboardText(pasteboard) {
  return ObjC.unwrap(pasteboard.stringForType($.NSPasteboardTypeString));
}

/**
 * Seed a named pasteboard with multiple representations.
 * @param {object} pasteboard Isolated pasteboard.
 * @param {object|null} data RTF or null to simulate missing RTF.
 */
function seed(pasteboard, data) {
  const item = $.NSPasteboardItem.alloc.init;

  item.setStringForType("original text", $.NSPasteboardTypeString);
  item.setStringForType("<b>old</b>", $.NSPasteboardTypeHTML);
  item.setStringForType("extra", "local.test.extra");

  if (data) item.setDataForType(data, $.NSPasteboardTypeRTF);

  pasteboard.clearContents;
  assert(pasteboard.writeObjects($.NSArray.arrayWithObject(item)), "seed pasteboard");
}

/**
 * Run conversion fixtures and programmatically constructed attributed inputs.
 * @param {string} root Repository root.
 * @returns {number} Number of conversion groups checked.
 */
function checkConversion(root) {
  const fixtureHTML = {};

  for (const name of ["formatting", "bullets", "nested", "extended"]) {
    const data = $.NSData.dataWithContentsOfFile(root + "/tests/fixtures/" + name + ".rtf");
    const html = convert(data);

    assert(typeof html === "string" && html.startsWith("<div>"), name + " returns one HTML string");
    assert(!/<code\s/.test(html), name + " has bare code tags");
    equal(html, convert(data), name + " is deterministic");
    fixtureHTML[name] = html;
  }

  equal(
    fixtureHTML.formatting,
    "<div>Frozen sets <i>are</i> merely <b>immutable</b>. <s>unique</s> <code>frozenset([1, 2, 4])</code> &lt; &amp; &gt;<br>\n  next line</div>",
    "baseline formatting",
  );
  equal((fixtureHTML.bullets.match(/<li>/g) || []).length, 2, "bullet item count");
  equal((fixtureHTML.nested.match(/<ul>/g) || []).length, 2, "nested list count");
  assert(fixtureHTML.nested.includes("- keep this code"), "monospace dash remains code");
  assert(fixtureHTML.nested.includes("After"), "ordinary text after list");
  assert(fixtureHTML.extended.includes("<u>underlined</u>"), "RTF underline");
  assert(fixtureHTML.extended.includes("<s><u><i><b><code>combined</code></b></i></u></s>"), "combined RTF styles");

  const endings = attributedText("A\r\nB\rC\nD");

  endings.addAttributeValueRange($.NSUnderlineStyleAttributeName, $(1), $.NSMakeRange(3, 1));
  equal(
    serialize(parseAttributed(endings)),
    "<div>A<br>\n  <u>B</u><br>\n  C<br>\n  D</div>",
    "line endings retain style offsets and source lines",
  );
  equal(convert(rtfData(endings)), "<div>A<br>\n  <u>B</u><br>\n  C<br>\n  D</div>", "RTF line endings");

  equal(
    serialize(parseAttributed(attributedText("A\n\nB"))),
    "<div>A<br>\n  <br>\n  B</div>",
    "consecutive line breaks each begin a new indented source line",
  );

  const unicode = attributedText("😀 e\u0301 👩‍💻 終");

  unicode.addAttributeValueRange($.NSUnderlineStyleAttributeName, $(1), $.NSMakeRange(0, 1));
  unicode.addAttributeValueRange($.NSStrikethroughStyleAttributeName, $(1), $.NSMakeRange(4, 1));
  equal(
    serialize(parseAttributed(unicode)),
    "<div><u>😀</u> e\u0301 👩‍💻 終</div>",
    "graphemes are never split at style boundaries",
  );
  equal(
    convert(rtfData(attributedText("😀 e\u0301 👩‍💻 終"))).normalize("NFC"),
    "<div>😀 é 👩‍💻 終</div>",
    "RTF preserves Unicode (AppKit may compose accents when exporting)",
  );

  const links = attributedText("web mail bad");

  links.addAttributeValueRange($.NSLinkAttributeName, $('https://example.com/?a=1&b="x"'), $.NSMakeRange(0, 3));
  links.addAttributeValueRange($.NSLinkAttributeName, $("mailto:a@example.com"), $.NSMakeRange(4, 4));
  links.addAttributeValueRange($.NSLinkAttributeName, $("javascript:alert(1)"), $.NSMakeRange(9, 3));

  const linkHTML = convert(rtfData(links));

  assert(serialize(parseAttributed(links)).includes("&quot;x&quot;"), "double quotes in link attributes are escaped");

  assert(linkHTML.includes('href="https://example.com/?a=1&amp;b=%22x%22"'), "escaped HTTPS destination");
  assert(linkHTML.includes('href="mailto:a@example.com"'), "mail destination");
  assert(!linkHTML.includes("javascript:") && linkHTML.includes("bad"), "unsafe destinations retain text only");

  const code = attributedText("  x\t y  ");

  code.addAttributeValueRange(
    $.NSFontAttributeName,
    $.NSFont.fontWithNameSize("Menlo-BoldItalic", 12),
    $.NSMakeRange(0, code.length),
  );
  equal(
    convert(rtfData(code)),
    "<div><i><b><code>  x\t y  </code></b></i></div>",
    "bare combined code retains whitespace",
  );

  const paddedHeading = attributedText("\tMy modifications for the Wrapper Meta-addon ");

  paddedHeading.addAttributeValueRange(
    $.NSFontAttributeName,
    $.NSFont.fontWithNameSize("Helvetica-Bold", 15),
    $.NSMakeRange(0, paddedHeading.length),
  );
  equal(
    serialize(parseAttributed(paddedHeading)),
    "<div>\n  <h4>My modifications for the Wrapper Meta-addon</h4>\n</div>",
    "heading edge whitespace is removed",
  );

  const paddedBold = attributedText("  bold text  ");

  paddedBold.addAttributeValueRange(
    $.NSFontAttributeName,
    $.NSFont.fontWithNameSize("Helvetica-Bold", 12),
    $.NSMakeRange(0, paddedBold.length),
  );
  equal(
    serialize(parseAttributed(paddedBold)),
    "<div><b>bold text</b></div>",
    "non-code inline tag edge whitespace is removed",
  );

  const markers = attributedText("Before\n- one\n\t• child\n◦ two\n▪ three\n‣ four\nAfter");
  const markerHTML = convert(rtfData(markers));

  equal((markerHTML.match(/<li>/g) || []).length, 5, "supported list markers");
  assert(
    markerHTML.startsWith("<div>\n  <div>Before</div>\n  <ul>\n    <li>one\n      <ul>"),
    "ordinary text and nested list structure",
  );
  assert(markerHTML.endsWith("  </ul>\n  <div>After</div>\n</div>"), "two-space block indentation");

  const emptyBlocks = serialize(parseAttributed(attributedText("Before\n- \nAfter")));

  equal(
    emptyBlocks,
    "<div>\n  <div>Before</div>\n  <div>After</div>\n</div>",
    "empty list items and text blocks are removed",
  );
  assert(!/<(?:div|li|ul)>\s*<\/(?:div|li|ul)>/.test(emptyBlocks), "no empty block elements");

  equal(
    serialize(parseAttributed(attributedText("  + Toggle\n\t+ Nested"))),
    "<div>+ Toggle<br>\n  + Nested</div>",
    "Craft toggle plus markers have no preceding source whitespace",
  );

  const styledToggle = attributedText("  + Styled toggle");

  styledToggle.addAttributeValueRange(
    $.NSFontAttributeName,
    $.NSFont.fontWithNameSize("Helvetica-Bold", 28),
    $.NSMakeRange(4, styledToggle.length - 4),
  );
  equal(
    serialize(parseAttributed(styledToggle)),
    "<div>\n  <h1>Styled toggle</h1>\n</div>",
    "a large heading style turns its Craft toggle into a heading",
  );

  const regularToggle = attributedText("+ Regular toggle");

  regularToggle.addAttributeValueRange(
    $.NSFontAttributeName,
    $.NSFont.fontWithNameSize("Helvetica", 15),
    $.NSMakeRange(2, regularToggle.length - 2),
  );
  equal(
    serialize(parseAttributed(regularToggle)),
    "<div>\n  <h4>Regular toggle</h4>\n</div>",
    "regular 15-point toggle text becomes an h4",
  );

  const italicToggle = attributedText("+ Italic toggle");

  italicToggle.addAttributeValueRange(
    $.NSFontAttributeName,
    $.NSFont.fontWithNameSize("Helvetica-Oblique", 15),
    $.NSMakeRange(2, italicToggle.length - 2),
  );
  equal(
    serialize(parseAttributed(italicToggle)),
    "<div>\n  <h4><i>Italic toggle</i></h4>\n</div>",
    "italic 15-point toggle text becomes an h4 and keeps its inline style",
  );

  const headings = attributedText("Title 1\nTitle 2\nTitle 3\nTitle 4\nBody");

  for (const [offset, size] of [
    [0, 24],
    [8, 20],
    [16, 17],
    [24, 15],
  ]) {
    headings.addAttributeValueRange(
      $.NSFontAttributeName,
      $.NSFont.fontWithNameSize("Helvetica-Bold", size),
      $.NSMakeRange(offset, 7),
    );
  }

  equal(
    serialize(parseAttributed(headings)),
    "<div>\n  <h1>Title 1</h1>\n  <h2>Title 2</h2>\n  <h3>Title 3</h3>\n  <h4>Title 4</h4>\n  <div>Body</div>\n</div>",
    "heading-sized Craft text uses semantic heading elements",
  );

  const regular15 = attributedText("Regular content");

  regular15.addAttributeValueRange(
    $.NSFontAttributeName,
    $.NSFont.fontWithNameSize("Helvetica", 15),
    $.NSMakeRange(0, regular15.length),
  );
  equal(
    serialize(parseAttributed(regular15)),
    "<div>Regular content</div>",
    "ordinary 15-point text stays directly inside the outer div",
  );

  const italic15 = attributedText("Italic content");

  italic15.addAttributeValueRange(
    $.NSFontAttributeName,
    $.NSFont.fontWithNameSize("Helvetica-Oblique", 15),
    $.NSMakeRange(0, italic15.length),
  );
  equal(
    serialize(parseAttributed(italic15)),
    "<div><i>Italic content</i></div>",
    "italic 15-point text stays an inline style rather than becoming a heading",
  );

  const nestedToggleHeadings = attributedText("+ Parent\nTitle 1\nTitle 2\nTitle 3\nTitle 4");

  nestedToggleHeadings.addAttributeValueRange(
    $.NSFontAttributeName,
    $.NSFont.fontWithNameSize("Helvetica-Bold", 30),
    $.NSMakeRange(2, 6),
  );

  for (const [offset, size] of [
    [9, 24],
    [17, 20],
    [25, 17],
    [33, 15],
  ]) {
    nestedToggleHeadings.addAttributeValueRange(
      $.NSFontAttributeName,
      $.NSFont.fontWithNameSize("Helvetica-Bold", size),
      $.NSMakeRange(offset, 7),
    );
  }

  equal(
    serialize(parseAttributed(nestedToggleHeadings)),
    "<div>\n  <h1>Parent</h1>\n  <h1>Title 1</h1>\n  <h2>Title 2</h2>\n  <h3>Title 3</h3>\n  <h4>Title 4</h4>\n</div>",
    "heading-styled toggle titles do not shift nested heading levels",
  );

  const toggleTreeText =
    "+ Getting Started\n  + Introduction\n    + A Brief Python History\n      + Where did Python get its name from?";
  const toggleTree = attributedText(toggleTreeText);

  for (const [title, size] of [
    ["Getting Started", 24],
    ["Introduction", 20],
    ["A Brief Python History", 17],
    ["Where did Python get its name from?", 17],
  ]) {
    toggleTree.addAttributeValueRange(
      $.NSFontAttributeName,
      $.NSFont.fontWithNameSize("Helvetica-Bold", size),
      $.NSMakeRange(toggleTreeText.indexOf(title), title.length),
    );
  }

  equal(
    serialize(parseAttributed(toggleTree)),
    "<div>\n  <h1>Getting Started</h1>\n  <h2>Introduction</h2>\n  <h3>A Brief Python History</h3>\n  <h4>Where did Python get its name from?</h4>\n</div>",
    "four nested heading toggle levels follow their indentation even when font sizes repeat",
  );

  const separatedHeadings = attributedText("Hello\n\nHello\n\nHello\n\nHello");

  for (const [offset, size] of [
    [0, 22],
    [7, 19],
    [14, 18],
    [21, 16],
  ]) {
    separatedHeadings.addAttributeValueRange(
      $.NSFontAttributeName,
      $.NSFont.fontWithNameSize("Helvetica-Bold", size),
      $.NSMakeRange(offset, 5),
    );
  }

  const separatedHeadingHTML = "<div>\n  <h1>Hello</h1>\n  <h2>Hello</h2>\n  <h3>Hello</h3>\n  <h4>Hello</h4>\n</div>";

  equal(
    serialize(parseAttributed(separatedHeadings)),
    separatedHeadingHTML,
    "four distinct heading font sizes map by relative order without empty headings",
  );
  equal(convert(rtfData(separatedHeadings)), separatedHeadingHTML, "RTF heading paragraphs omit empty headings");

  return 10;
}

/**
 * Build simulated operations and recording notifications around a native pasteboard.
 * @param {object} pasteboard Isolated pasteboard.
 * @param {object} data RTF to publish on simulated Copy.
 * @param {object} options Failure or timing overrides.
 * @returns {object} Test scenario and its recorded events.
 */
function scenario(pasteboard, data, options) {
  const events = [];
  const notices = [];
  const state = { freshRevision: null };
  const craft = { bundle: CRAFT_BUNDLE, pid: 42 };
  let time = 0;
  let focusCalls = 0;
  let copied = false;
  let conversions = 0;

  const operations = {
    /** @returns {object} Simulated frontmost identity. */
    frontmost() {
      focusCalls++;
      events.push("focus");

      return options.focus ? options.focus(focusCalls, copied, conversions) : craft;
    },

    /** @returns {boolean} Simulated held modifiers. */
    modifiersHeld() {
      events.push("modifiers");

      return options.held || (options.releaseAt && time < options.releaseAt);
    },

    /** Simulate an allowed, denied, or stale copy. */
    sendCopy() {
      events.push("copy");

      if (options.permission) throw new Error("denied");

      copied = true;

      if (!options.stale && !options.delayed) {
        seed(pasteboard, options.missing ? null : data);
        state.freshRevision = Number(pasteboard.changeCount);
      }
    },

    /** @returns {number} Simulated clock. */
    now() {
      return time;
    },

    /** Advance the clock without sleeping or sending keys. */
    pause() {
      time += 25;

      if (options.delayed && copied && time >= 100 && state.freshRevision === null) {
        seed(pasteboard, data);
        state.freshRevision = Number(pasteboard.changeCount);
      }
    },

    /** @returns {string} Stable recording identity. */
    identity() {
      return "test-run";
    },

    /**
     * Invoke conversion or simulate a parsing/conversion failure.
     * @param {object} input RTF data.
     * @returns {string} Generated HTML.
     */
    convert(input) {
      events.push("convert");
      conversions++;

      if (options.conversion) throw new Error("Conversion failed.");

      const html = convert(input);

      if (options.revision) {
        pasteboard.clearContents;
        pasteboard.setStringForType("newer copy", $.NSPasteboardTypeString);
      }

      return html;
    },

    /**
     * Prepare output or simulate allocation failure before clearing.
     * @param {string} html Generated source.
     * @returns {object} Plain-text pasteboard item.
     */
    prepare(html) {
      events.push("prepare");

      if (options.prepare) throw new Error("Could not prepare output.");

      const item = prepareOutput(html);

      equal(
        ObjC.deepUnwrap(item.types),
        ["public.utf8-plain-text"],
        "prepared item declares exactly one plain-text type",
      );

      return item;
    },
  };

  /**
   * Record the actual adapter's native delivery calls and clipboard state.
   * @param {string} identity Stage-specific notification identifier.
   * @param {string} message Status text.
   */
  function recordNotification(identity, message) {
    events.push(message === STARTED ? "started" : "terminal");
    notices.push([identity, message]);

    if (message === READY)
      assert(clipboardText(pasteboard) === "<div>Hello</div>", "ready occurs only after output write");
  }

  const notifications = nativeNotifications(recordNotification);

  return { operations, notifications, events, notices, state };
}

/**
 * Check native clipboard semantics and failures using named pasteboards only.
 * @returns {number} Number of integration scenarios.
 */
function checkWorkflow() {
  const pasteboard = $.NSPasteboard.pasteboardWithUniqueName;
  const data = rtfData(attributedText("Hello"));
  const cases = [
    { name: "success", options: {} },
    { name: "delayed fresh copy", options: { releaseAt: 100, delayed: true } },
    { name: "wrong bundle despite Craft name", options: { focus: wrongApp }, error: "native Craft" },
    { name: "held modifiers", options: { held: true }, error: "Release" },
    { name: "permission denied", options: { permission: true }, error: "Copy could not run" },
    { name: "stale clipboard", options: { stale: true }, error: "No new copy" },
    { name: "missing RTF", options: { missing: true }, error: "Select formatted text" },
    {
      name: "invalid RTF",
      options: {},
      data: $("not RTF").dataUsingEncoding($.NSUTF8StringEncoding),
      error: "Could not read",
    },
    { name: "empty RTF", options: {}, data: rtfData(attributedText("")), error: "empty rich text" },
    { name: "conversion failed", options: { conversion: true }, error: "Conversion failed" },
    { name: "prepare failed", options: { prepare: true }, error: "Could not prepare" },
    { name: "newer clipboard", options: { revision: true }, error: "Clipboard changed" },
    { name: "focus before Copy", options: { focus: beforeCopy }, error: "Focus changed" },
    { name: "different Craft process", options: { focus: differentProcess }, error: "Focus changed" },
    { name: "focus after Copy", options: { focus: afterCopy } },
    { name: "focus before write", options: { focus: beforeWrite } },
    { name: "focus while modifiers held", options: { held: true, focus: beforeCopy }, error: "Focus changed" },
    { name: "focus during fresh-copy wait", options: { stale: true, focus: afterCopy }, error: "No new copy" },
    { name: "write failed", options: { write: true }, error: "Could not write" },
  ];

  /** @returns {object} Non-Craft app with a misleading display name. */
  function wrongApp() {
    return { bundle: "local.other", pid: 42, name: "Craft" };
  }

  /**
   * Change focus before sending Copy.
   * @param {number} calls Focus queries.
   * @returns {object} App identity.
   */
  function beforeCopy(calls) {
    return { bundle: calls > 1 ? "local.other" : CRAFT_BUNDLE, pid: 42 };
  }

  /**
   * Simulate a different process with the same Craft identity.
   * @param {number} calls Focus queries.
   * @returns {object} App identity.
   */
  function differentProcess(calls) {
    return { bundle: CRAFT_BUNDLE, pid: calls > 1 ? 43 : 42 };
  }

  /**
   * Change focus once Copy has been requested.
   * @param {number} calls Focus queries.
   * @param {boolean} copied Whether Copy was sent.
   * @returns {object} App identity.
   */
  function afterCopy(calls, copied) {
    return { bundle: copied ? "local.other" : CRAFT_BUNDLE, pid: 42 };
  }

  /**
   * Change focus during conversion.
   * @param {number} calls Focus queries.
   * @param {boolean} copied Whether Copy was sent.
   * @param {number} conversions Completed conversion calls.
   * @returns {object} App identity.
   */
  function beforeWrite(calls, copied, conversions) {
    return { bundle: conversions ? "local.other" : CRAFT_BUNDLE, pid: 42 };
  }

  try {
    for (const test of cases) {
      seed(pasteboard, data);

      const initialRevision = Number(pasteboard.changeCount);
      const testCase = scenario(pasteboard, test.data || data, test.options);
      let target = pasteboard;

      if (test.options.write) {
        target = {
          /** @returns {number} Native revision. */
          get changeCount() {
            return pasteboard.changeCount;
          },

          /** @returns {number} Clear the isolated board. */
          get clearContents() {
            return pasteboard.clearContents;
          },

          /**
           * Read native input.
           * @param {object} type Pasteboard type.
           * @returns {object} Native data.
           */
          dataForType(type) {
            return pasteboard.dataForType(type);
          },

          /** @returns {boolean} Controlled native-write failure. */
          writeObjects() {
            return false;
          },
        };
      }

      const result = execute(target, testCase.operations, testCase.notifications);

      if (test.error) {
        assert(result.includes(test.error), test.name + " failure: " + result);
        assert(!testCase.notices.some(isReady), test.name + " never reports ready");

        if (testCase.notices.length) {
          equal(
            testCase.notices,
            [
              ["craft-html-test-run-started", STARTED],
              ["craft-html-test-run-finished", result],
            ],
            test.name + " posts a separate failure after started",
          );
        }

        if (test.options.revision) equal(clipboardText(pasteboard), "newer copy", "preserve newer clipboard");
        else if (!test.options.write)
          equal(clipboardText(pasteboard), "original text", test.name + " preserves clipboard contents");
        else equal(Number(pasteboard.pasteboardItems.count), 0, "write failure may leave clipboard empty");

        if (!test.options.revision && !test.options.write) {
          equal(
            Number(pasteboard.changeCount),
            testCase.state.freshRevision === null ? initialRevision : testCase.state.freshRevision,
            test.name + " does not mutate any copied representations",
          );
        }

        if (test.options.stale || test.options.permission || test.options.held)
          assert(!testCase.events.includes("convert"), test.name + " never converts stale input");
      } else {
        equal(result, READY, test.name + " status");

        if (test.name === "focus after Copy" || test.name === "focus before write") {
          equal(testCase.events.filter((event) => event === "focus").length, 2, test.name + " does not recheck focus");
        }

        equal(clipboardText(pasteboard), "<div>Hello</div>", "literal HTML source");
        equal(Number(pasteboard.pasteboardItems.count), 1, "one output item");

        const item = pasteboard.pasteboardItems.objectAtIndex(0);
        const types = ObjC.deepUnwrap(item.types);
        const aliases = ["NSStringPboardType", "public.text", "public.plain-text", "public.utf16-plain-text"];

        assert(types.includes("public.utf8-plain-text"), "plain-text output declared");
        equal(types.filter(isExplicitType), ["public.utf8-plain-text"], "one explicit output representation");
        assert(item.dataForType($.NSPasteboardTypeHTML).isNil(), "no HTML representation");
        assert(item.dataForType($.NSPasteboardTypeRTF).isNil(), "no RTF representation");
        equal(
          testCase.notices,
          [
            ["craft-html-test-run-started", STARTED],
            ["craft-html-test-run-finished", READY],
          ],
          "separate started and ready notification identities",
        );
        assert(testCase.events.indexOf("focus") < testCase.events.indexOf("started"), "validate before started");
        assert(
          testCase.events.indexOf("started") < testCase.events.indexOf("modifiers"),
          "started before modifier wait",
        );
        assert(testCase.events.indexOf("copy") < testCase.events.indexOf("convert"), "fresh copy before conversion");

        /**
         * Exclude only known system-synthesized string aliases.
         * @param {string} type Published type.
         * @returns {boolean} Whether this is an explicitly declared type.
         */
        function isExplicitType(type) {
          return !aliases.includes(type);
        }
      }
    }

    seed(pasteboard, data);

    const first = scenario(pasteboard, data, {});

    equal(execute(pasteboard, first.operations, first.notifications), READY, "first invocation");

    const second = scenario(pasteboard, data, { stale: true });

    assert(
      execute(pasteboard, second.operations, second.notifications).includes("No new copy"),
      "subsequent invocation must copy afresh",
    );
    equal(clipboardText(pasteboard), "<div>Hello</div>", "failed subsequent copy preserves previous HTML");
    assert(second.events.includes("copy") && !second.events.includes("convert"), "never re-escape previous HTML");
  } finally {
    pasteboard.releaseGlobally;
  }

  return cases.length + 1;
}

/**
 * Identify a success notification in recorded events.
 * @param {string[]} notice Recorded identity and message.
 * @returns {boolean} Whether ready was reported.
 */
function isReady(notice) {
  return notice[1] === READY;
}

/**
 * Check separate progress and result identities without real notifications.
 * @returns {number} Number of notification states checked.
 */
function checkNotifications() {
  const delivered = {};
  const calls = [];

  /**
   * Record messages sent to the background app without launching it.
   * @param {string} identity Stage-specific notification identity.
   * @param {string} message Status text.
   */
  function deliver(identity, message) {
    delivered[identity] = message;
    calls.push([identity, message]);
  }

  const notifications = nativeNotifications(deliver);

  notifications.show("success", STARTED);
  notifications.finish("success", READY);
  equal(delivered, { "success-started": STARTED, "success-finished": READY }, "ready has a separate banner identity");
  notifications.show("failure", STARTED);
  notifications.finish("failure", "Copy failed.");
  equal(delivered["failure-started"], STARTED, "failure leaves the started notification intact");
  equal(delivered["failure-finished"], "Copy failed.", "failure gets its own banner identity");
  equal(
    calls,
    [
      ["success-started", STARTED],
      ["success-finished", READY],
      ["failure-started", STARTED],
      ["failure-finished", "Copy failed."],
    ],
    "separate stage identities are stable and unique per run",
  );

  return calls.length;
}

/**
 * Execute tests; production entry point is replaced only in this harness.
 * @param {string[]} argv Repository root supplied by the Python test runner.
 * @returns {string} Test summary as JSON.
 */
function run(argv) {
  return JSON.stringify({
    conversionGroups: checkConversion(argv[0]),
    workflowScenarios: checkWorkflow(),
    notificationStates: checkNotifications(),
  });
}
