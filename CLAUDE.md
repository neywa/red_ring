# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

"Pinterest Ad Marker" — a Chrome Manifest V3 extension that outlines promoted/sponsored pins on pinterest.com with a red border and an "AD" badge.

## Build / test / run

There is no build step, package manager, test suite, or version control here. The four files in the root *are* the shipped extension.

To run it: `chrome://extensions` → enable Developer mode → "Load unpacked" → select this directory. After editing `content.js` or `style.css`, click the reload icon on the extension card, then hard-reload the Pinterest tab.

Debugging happens in the Pinterest tab's DevTools console (content scripts log there, not in the extension's service worker console — there is no background script).

## Architecture

The entire extension is one content script ([content.js](content.js)) plus a stylesheet, injected at `document_idle` on `*://*.pinterest.com/*`.

The one non-obvious constraint that shapes all of the code: **Pinterest's feed is a virtualized masonry grid that recycles DOM nodes.** A node holding an ad can be repopulated with a regular pin as the user scrolls. Consequences:

- Marking a node "already processed" and skipping it is wrong. `applyMarking` re-evaluates each pin's *current* content on every pass and both adds and removes the outline to match.
- A `MutationObserver` on `document.body` (childList + subtree + characterData) triggers a debounced full re-scan (150ms) rather than reacting to individual mutations.

Ad detection is text-based: look for "sponsored"/"promoted" inside `[data-test-id="pinrep-footer"]`, falling back to the pin's whole text. The outline is applied to the enclosing `[data-grid-item="true"]` tile (not the inner pin) so the border wraps the full visible card.

The content script only ever toggles a class — it never injects DOM. The "AD" chip is a `::before` pseudo-element on `.pam-ad-outline`. Keep it that way: appending real nodes into Pinterest's React-managed tiles risks `NotFoundError` crashes during reconciliation, and a node whose presence is guarded by a class React can rewrite will duplicate.

Because detection depends on Pinterest's `data-test-id` attributes and label wording, breakage after a Pinterest redesign most likely means those selectors or keywords changed — check them first.
