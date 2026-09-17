# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

"Pinterest Ad Marker" — a Chrome Manifest V3 extension that outlines promoted/sponsored pins on pinterest.com with a red border and an "AD" badge.

## Build / test / run

The extension has no build step — the files in the root *are* what ships, and nothing in `test/` is part of it.

To run it: `chrome://extensions` → enable Developer mode → "Load unpacked" → select this directory. After editing `content.js` or `style.css`, click the reload icon on the extension card, then hard-reload the Pinterest tab.

Tests: `cd test && npm install && npm test`. They load `content.js` into a jsdom page and assert against real DOM state, so no mocking of the DOM is involved. `test/` has its own `package.json` deliberately — keeping `node_modules` out of the extension root, since Chrome packs everything in the loaded directory. To run a single case, comment out the others; the runner is a plain script with a `check()` helper, not a framework.

When changing detection or scanning behaviour, verify a new test fails against the *old* code before trusting it — several of these cases would pass against the bug they were written for if constructed carelessly.

Debugging happens in the Pinterest tab's DevTools console (content scripts log there, not in the extension's service worker console — there is no background script).

## Architecture

The entire extension is one content script ([content.js](content.js)) plus a stylesheet, injected at `document_idle` on `*://*.pinterest.com/*`.

The one non-obvious constraint that shapes all of the code: **Pinterest's feed is a virtualized masonry grid that recycles DOM nodes.** A node holding an ad can be repopulated with a regular pin as the user scrolls. Consequences:

- Marking a node "already processed" and skipping it is wrong. `scanAllPins` re-evaluates each pin's *current* content on every pass and both adds and removes the outline to match.
- Because the outline lives on the ancestor tile rather than the pin, a tile can outlive the pin that marked it and become unreachable from any pin. So each pass also sweeps elements already carrying the outline class, not just `PIN_SELECTOR` matches. `scanAllPins` resolves the desired state for all tiles into a Set first and only then writes, so neither pass can undo the other's result.
- A `MutationObserver` on `document.body` (childList + subtree only) triggers a throttled full re-scan (150ms) rather than reacting to individual mutations. `characterData` is deliberately *not* observed: it put every text node on the page under observation and kept the scan loop running at ~10Hz on an idle feed. The accepted cost is that React patching a footer's text in place is invisible, so a recycled tile can briefly go unmarked until the next structural mutation — this is covered by a test.

Ad detection is text-based: look for "sponsored"/"promoted" inside `[data-test-id="pinrep-footer"]`, and return false if that footer is absent. There is deliberately no fallback to the pin's whole text, which would flag pins whose author-written title or description merely mentions those words. The tradeoff is that detection rests entirely on that one selector: if Pinterest renames it, the extension silently marks nothing rather than degrading. The outline is applied to the enclosing `[data-grid-item="true"]` tile (not the inner pin) so the border wraps the full visible card.

The content script only ever toggles a class — it never injects DOM. The "AD" chip is a `::before` pseudo-element on `.pam-ad-outline`. Keep it that way: appending real nodes into Pinterest's React-managed tiles risks `NotFoundError` crashes during reconciliation, and a node whose presence is guarded by a class React can rewrite will duplicate.

Because detection depends on Pinterest's `data-test-id` attributes and label wording, breakage after a Pinterest redesign most likely means those selectors or keywords changed — check them first.
