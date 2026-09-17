// Loads content.js into a jsdom page and asserts against real DOM state.
// Run with: cd test && npm install && npm test
const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");

const code = fs.readFileSync(path.join(__dirname, "..", "content.js"), "utf8");

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
