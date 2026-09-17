# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

"Pinterest Ad Marker" — a Chrome Manifest V3 extension that outlines promoted/sponsored pins on pinterest.com with a red border and an "AD" chip.

## Build / test / run

The extension has no build step — the files in the root *are* what ships, and nothing in `test/` is part of it.

To run it: `chrome://extensions` → enable Developer mode → "Load unpacked" → select this directory. After editing `content.js` or `style.css`, click the reload icon on the extension card, then hard-reload the Pinterest tab.

Tests: `cd test && npm install && npm test`. They load `content.js` into a jsdom page and assert against real DOM state, so no mocking of the DOM is involved. `test/` has its own `package.json` deliberately — keeping `node_modules` out of the extension root, since Chrome packs everything in the loaded directory. To run a single case, comment out the others; the runner is a plain script with a `check()` helper, not a framework.

When changing detection or scanning behaviour, verify a new test fails against the *old* code before trusting it — several of these cases would pass against the bug they were written for if constructed carelessly. `PAM_SRC=/path/to/old/content.js npm test` runs the suite against a different copy of the script, which is the cheap way to do that: snapshot `content.js`, write the test, confirm it fails against the snapshot, then make the change.

Debugging happens in the Pinterest tab's DevTools console (content scripts log there, not in the extension's service worker console — there is no background script).

## Architecture

The entire extension is one content script ([content.js](content.js)) plus a stylesheet, injected at `document_idle` on `*://*.pinterest.com/*`.

The one non-obvious constraint that shapes all of the code: **Pinterest's feed is a virtualized masonry grid that recycles DOM nodes.** A node holding an ad can be repopulated with a regular pin as the user scrolls. Consequences:

- Marking a node "already processed" and skipping it is wrong. `scanAllPins` re-evaluates each pin's *current* content on every pass and both adds and removes the outline to match.
- Because the outline lives on the ancestor tile rather than the pin, a tile can outlive the pin that marked it and become unreachable from any pin. So each pass also sweeps elements already carrying the outline class, not just `PIN_SELECTOR` matches. `scanAllPins` resolves the desired state for all tiles into a Set first and only then writes, so neither pass can undo the other's result.
- A `MutationObserver` on `document.documentElement` (childList + subtree only) triggers a throttled full re-scan (150ms) rather than reacting to individual mutations. `characterData` is deliberately *not* observed: it put every text node on the page under observation and kept the scan loop running at ~10Hz on an idle feed. The accepted cost is that React patching a footer's text in place is invisible, so a recycled tile can briefly go unmarked until the next structural mutation — this is covered by a test.
- The target is the root element rather than `document.body` because `observe()` binds to the node it is handed, not to whatever `document.body` currently refers to. Observing body means that replacing body leaves the observer watching a detached node and the extension stops marking anything for the life of the page — silently, since detection is unharmed and a manual `scanAllPins()` still works. Watching the root costs one thing: `<head>` churn now wakes the scan as well, bounded by the same 150ms throttle. Both the survival and the throttle behaviour are covered by tests.

Ad detection is text-based, and narrower than "the keyword appears in the footer" — that question is not the same as "this pin carries an ad label". Two constraints shape `isAdPin`:

- **The footer must belong to that pin.** Pins nest (collection and carousel ad units), so `pinEl.querySelector('[data-test-id="pinrep-footer"]')` reaches into a *descendant* pin's footer. `isAdPin` therefore takes the first footer whose `closest(PIN_SELECTOR)` is the pin itself. Dropping this doesn't only produce false positives: when the nested footer comes first in document order it is returned *instead of* the pin's own, so a genuine ad label is never read and the ad goes unmarked.
- **The match is against a label-shaped element, not the footer's text.** `pinrep-footer` also carries the pin title and the board/creator attribution, all author-controlled. `AD_LABEL_RE` (`^(?:promoted|sponsored)(?:\s+by\b.*)?$`) is tested against each element in the footer individually, on whitespace-normalized text. Matching the footer's aggregate `textContent` instead marks a pin titled "Sponsored hiking gear roundup" or saved to a board named "Promoted Kitchens", and — since `textContent` concatenates with no separator — can splice a keyword across a sibling boundary that appears nowhere on screen. Each element's *whole subtree* text is used rather than leaf text, so a label split as `<span>Promoted</span><span> by Acme</span>` still matches.

Both ends of `AD_LABEL_RE` are anchored on purpose. A label variant carrying trailing text in the same element (a `·` separator, a domain) won't match and the pin goes unmarked — the same failure mode chosen for a renamed selector: detection rests entirely on `pinrep-footer` and this wording, and when either changes the extension silently marks nothing rather than degrading into marking the wrong pins. The outline is applied to the enclosing `[data-grid-item="true"]` tile (not the inner pin) so the border wraps the full visible card, falling back to the pin element itself when no such tile exists.

The content script only ever toggles a class — it never injects DOM. The "AD" chip is a `::before` pseudo-element on `.pam-ad-outline`. Keep it that way: appending real nodes into Pinterest's React-managed tiles risks `NotFoundError` crashes during reconciliation, and a node whose presence is guarded by a class React can rewrite will duplicate.

`.pam-ad-outline` carries `position: relative` so that pseudo-element anchors to the tile rather than to some distant ancestor — it is load-bearing, not incidental. It is also the one declaration here that can affect Pinterest's layout, since the target is usually a masonry tile Pinterest positions itself. Inline styles win over this rule in the normal case, but if the grid ever collapses into a single flowing column after a Pinterest change, suspect this line first.

Because detection depends on Pinterest's `data-test-id` attributes and label wording, breakage after a Pinterest redesign most likely means those selectors or the label text changed — check them first. If real promoted pins stop being marked while the selectors are intact, inspect the label element in DevTools: the likely cause is trailing text inside it that `AD_LABEL_RE`'s end anchor rejects.

**Verified against Pinterest's live DOM on 2026-09-17**: every promoted pin in the feed was outlined, so the anchored pattern did match the real label markup on that date. This is the baseline worth having before touching the anchors — a silent failure after it means Pinterest changed something, not that the pattern never worked. Note what that check does and does not establish: an all-clean feed confirms recall, but says nothing about precision, since a feed with no "Sponsored"-titled pins in it looks identical either way. The false-positive behaviour is pinned by tests, not by that observation.
