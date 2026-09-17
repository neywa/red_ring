// Loads content.js into a jsdom page and asserts against real DOM state.
// Run with: cd test && npm install && npm test
const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");

// PAM_SRC points the suite at a different content.js. CLAUDE.md asks that a new
// detection test be shown to fail against the OLD code before it is trusted;
// this makes that a one-liner:
//   PAM_SRC=/path/to/old/content.js npm test
const SRC = process.env.PAM_SRC || path.join(__dirname, "..", "content.js");
const code = fs.readFileSync(SRC, "utf8");

function setup(html) {
  const dom = new JSDOM(`<body>${html}</body>`, { runScripts: "outside-only" });
  dom.window.eval(code);
  return dom;
}

const tile = (id, label, extra = "") => `
  <div data-grid-item="true" id="${id}">
    <div data-test-id="pin">
      <div data-test-id="pinrep-footer">${label}</div>
    </div>${extra}
  </div>`;

const marked = (dom, id) =>
  dom.window.document.getElementById(id).classList.contains("pam-ad-outline");

let pass = 0, fail = 0;
const check = (name, actual, expected) => {
  const ok = actual === expected;
  ok ? pass++ : fail++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : `  (got ${actual}, want ${expected})`}`);
};

// --- baseline ---
{
  const dom = setup(tile("ad", "Promoted by Acme") + tile("plain", "Cute cats"));
  check("ad tile outlined", marked(dom, "ad"), true);
  check("regular tile not outlined", marked(dom, "plain"), false);
}

// --- THE BUG: tile keeps its pin unmounted (virtualization) ---
{
  const dom = setup(tile("ad", "Sponsored"));
  check("  precondition: marked", marked(dom, "ad"), true);
  const t = dom.window.document.getElementById("ad");
  t.innerHTML = ""; // React unmounts the pin, keeps the tile
  dom.window.scanAllPins();
  check("stale outline swept after pin unmounted", marked(dom, "ad"), false);
}

// --- recycling: ad tile repopulated with a non-ad pin ---
{
  const dom = setup(tile("t", "Promoted"));
  const t = dom.window.document.getElementById("t");
  t.innerHTML = `<div data-test-id="pin"><div data-test-id="pinrep-footer">Sourdough</div></div>`;
  dom.window.scanAllPins();
  check("recycled into non-ad pin is unmarked", marked(dom, "t"), false);
}

// --- reverse recycling: regular tile becomes an ad ---
{
  const dom = setup(tile("t", "Sourdough"));
  const t = dom.window.document.getElementById("t");
  t.innerHTML = `<div data-test-id="pin"><div data-test-id="pinrep-footer">Promoted</div></div>`;
  dom.window.scanAllPins();
  check("recycled into ad pin is marked", marked(dom, "t"), true);
}

// --- fallback path: ad pin with no grid-item ancestor marks itself ---
{
  const dom = setup(
    `<div data-test-id="pin" id="bare"><div data-test-id="pinrep-footer">Sponsored</div></div>`
  );
  check("bare pin (no tile ancestor) marked", marked(dom, "bare"), true);
  dom.window.scanAllPins(); // must survive the sweep, not be unmarked then re-added
  check("bare pin still marked after rescan", marked(dom, "bare"), true);
}

// --- multi-pin tile: OR semantics, order-independent ---
{
  const adFirst = `<div data-test-id="pin"><div data-test-id="pinrep-footer">Promoted</div></div>
                   <div data-test-id="pin"><div data-test-id="pinrep-footer">Cats</div></div>`;
  const adLast = `<div data-test-id="pin"><div data-test-id="pinrep-footer">Cats</div></div>
                  <div data-test-id="pin"><div data-test-id="pinrep-footer">Promoted</div></div>`;
  check("tile w/ ad pin first marked",
    marked(setup(`<div data-grid-item="true" id="t">${adFirst}</div>`), "t"), true);
  check("tile w/ ad pin last marked (order-independent)",
    marked(setup(`<div data-grid-item="true" id="t">${adLast}</div>`), "t"), true);
}

// --- idempotence: repeated scans don't drift ---
{
  const dom = setup(tile("ad", "Promoted") + tile("plain", "Cats"));
  for (let i = 0; i < 5; i++) dom.window.scanAllPins();
  check("repeated scans keep ad marked", marked(dom, "ad"), true);
  check("repeated scans keep regular unmarked", marked(dom, "plain"), false);
  check("no stray marked elements",
    dom.window.document.querySelectorAll(".pam-ad-outline").length, 1);
}

// --- detection is footer-only (no whole-text fallback) ---
{
  // Pin with no footer whose own copy discusses sponsorship: the false positive.
  const dom = setup(`
    <div data-grid-item="true" id="t">
      <div data-test-id="pin">How to land your first sponsored post</div>
    </div>`);
  check("footerless pin mentioning 'sponsored' not marked", marked(dom, "t"), false);
}
{
  const dom = setup(`
    <div data-grid-item="true" id="t">
      <div data-test-id="pin">Promoted pin strategies that work</div>
    </div>`);
  check("footerless pin mentioning 'promoted' not marked", marked(dom, "t"), false);
}
{
  const dom = setup(`
    <div data-grid-item="true" id="t"><div data-test-id="pin">Banana bread</div></div>`);
  check("footerless innocuous pin not marked", marked(dom, "t"), false);
}
{
  // Title says "Promoted", footer says otherwise — footer is authoritative.
  const dom = setup(`
    <div data-grid-item="true" id="t">
      <div data-test-id="pin">
        <h3>Promoted post ideas</h3>
        <div data-test-id="pinrep-footer">pinterest.com</div>
      </div>
    </div>`);
  check("title keyword ignored when footer is clean", marked(dom, "t"), false);
}
{
  // Recall guard: a real ad label in the footer must still be caught.
  const dom = setup(tile("t", "Promoted by Acme"));
  check("genuine footer ad label still marked", marked(dom, "t"), true);
}

// --- footer text is not the same thing as an ad LABEL ---
// pinrep-footer carries the pin title and board/creator attribution alongside
// the ad label, so "does the keyword appear anywhere in this footer" answers a
// different question from "does this pin carry an ad label".

// A footer with internal structure, the way Pinterest actually builds one.
const richTile = (id, inner) => `
  <div data-grid-item="true" id="${id}">
    <div data-test-id="pin">
      <div data-test-id="pinrep-footer">${inner}</div>
    </div>
  </div>`;

{
  const dom = setup(richTile("t", `
    <div class="title">Sponsored hiking gear roundup</div>
    <div class="attr">outdoorsy.com</div>`));
  check("author title beginning with 'Sponsored' not marked", marked(dom, "t"), false);
}
{
  const dom = setup(richTile("t", `<span>Saved to Promoted Kitchens</span>`));
  check("board name containing 'Promoted' not marked", marked(dom, "t"), false);
}
{
  // textContent concatenates with no separator, so a blob match sees
  // "Nikon Sponsored lens" — a keyword that is nowhere on screen.
  const dom = setup(richTile("t", `<span>Nikon Spon</span><span>sored lens</span>`));
  check("keyword spliced across sibling elements not marked", marked(dom, "t"), false);
}

// --- recall guards: the anchored matcher must still catch real labels ---
{
  const dom = setup(richTile("t", `
    <div class="title">Wool socks</div>
    <div class="label">Promoted by Acme</div>`));
  check("real label beside a title still marked", marked(dom, "t"), true);
}
{
  // Matching each element's whole subtree text (rather than leaf text) is what
  // keeps a label split across spans working.
  const dom = setup(richTile("t", `<div><span>Promoted</span><span> by Acme</span></div>`));
  check("label split across spans still marked", marked(dom, "t"), true);
}
{
  const dom = setup(richTile("t", `<div>\n      Sponsored\n    </div>`));
  check("label padded with newlines still marked", marked(dom, "t"), true);
}

// --- nested pins: a footer belongs to exactly one pin ---
// Pins nest (collection/carousel ad units). These use the fallback path — no
// [data-grid-item="true"] ancestor — so the outer and inner pins resolve to
// different outline targets and ownership is observable.
{
  const dom = setup(`
    <div data-test-id="pin" id="outer">
      <div data-test-id="pin" id="inner">
        <div data-test-id="pinrep-footer">Promoted</div>
      </div>
    </div>`);
  check("outer pin does not inherit nested pin's label", marked(dom, "outer"), false);
  check("nested promoted pin marks itself", marked(dom, "inner"), true);
}
{
  // Nested footer first in document order, the pin's own clean footer second.
  const dom = setup(`
    <div data-test-id="pin" id="outer">
      <div data-test-id="pin"><div data-test-id="pinrep-footer">Promoted</div></div>
      <div data-test-id="pinrep-footer">Banana bread</div>
    </div>`);
  check("own clean footer wins over an earlier nested one", marked(dom, "outer"), false);
}
{
  // The same bug in the direction that MISSES an ad: the first footer in
  // document order belongs to the nested pin, so the outer pin's own ad label
  // was never read.
  const dom = setup(`
    <div data-test-id="pin" id="outer">
      <div data-test-id="pin"><div data-test-id="pinrep-footer">Cats</div></div>
      <div data-test-id="pinrep-footer">Promoted by Acme</div>
    </div>`);
  check("own label after a nested footer still marked", marked(dom, "outer"), true);
}
{
  // Retained OR semantics: in a grid a promoted sub-pin still rings the tile,
  // because a collection/carousel ad unit genuinely is an ad.
  const dom = setup(`
    <div data-grid-item="true" id="t">
      <div data-test-id="pin">
        <div data-test-id="pin"><div data-test-id="pinrep-footer">Promoted by Acme</div></div>
      </div>
    </div>`);
  check("collection-ad tile still marked via nested pin", marked(dom, "t"), true);
}

// --- observer-level: what the MutationObserver config actually reacts to ---
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const SETTLE = 250; // > the 150ms throttle window

(async () => {
  {
    // Structural change must still schedule a scan — the behaviour that must not regress.
    const dom = setup(`<div id="host"></div>`);
    dom.window.document
      .getElementById("host")
      .insertAdjacentHTML("beforeend", tile("late", "Promoted by Acme"));
    check("  precondition: not yet scanned", marked(dom, "late"), false);
    await sleep(SETTLE);
    check("childList mutation triggers scan", marked(dom, "late"), true);
  }

  {
    // Documents the accepted blind spot: an in-place text edit is now invisible.
    const dom = setup(tile("t", "Banana bread"));
    const footer = dom.window.document.querySelector('[data-test-id="pinrep-footer"]');
    footer.firstChild.nodeValue = "Promoted"; // characterData mutation, no childList
    await sleep(SETTLE);
    check("characterData-only edit does NOT trigger scan", marked(dom, "t"), false);

    // ...but ambient structural churn elsewhere corrects it, as argued in the plan.
    dom.window.document.body.appendChild(dom.window.document.createElement("div"));
    await sleep(SETTLE);
    check("later childList churn picks up the missed edit", marked(dom, "t"), true);
  }

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
