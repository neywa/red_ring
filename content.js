/**
 * Pinterest Ad Marker
 *
 * Pinterest's feed is a virtualized masonry grid: DOM nodes get RECYCLED
 * and repopulated with different pin content as you scroll (this isn't a
 * simple "append new nodes" feed). That means we can't just mark a node
 * "already processed" and skip it forever — the same node might hold an
 * ad, then a moment later hold a regular pin. So instead of a one-time
 * scan, we re-evaluate every visible pin on each mutation batch and
 * toggle the outline class on/off to match its CURRENT content.
 *
 * The outline sits on the ancestor grid tile, not the pin, and a tile can
 * outlive the pin that caused it to be marked. Such a tile is reachable
 * from no pin, so each pass also sweeps already-marked tiles — otherwise a
 * stale outline would sit on an empty tile until something remounted there.
 */

// Pinterest's ad label is its own element reading exactly "Promoted",
// "Sponsored", or "Promoted by <advertiser>". Anchoring both ends is what keeps
// the author-written text in the same footer — pin titles, board names — from
// matching. A label variant with trailing text won't match and the pin goes
// unmarked: the same deliberate tradeoff made for a renamed selector, marking
// nothing rather than marking the wrong pins.
const AD_LABEL_RE = /^(?:promoted|sponsored)(?:\s+by\b.*)?$/i;
const PIN_SELECTOR = '[data-test-id="pin"]';
const OUTLINE_CLASS = "pam-ad-outline";
const OUTLINE_SELECTOR = `.${OUTLINE_CLASS}`;

function normalize(text) {
  return (text || "").replace(/\s+/g, " ").trim();
}

function isAdPin(pinEl) {
  // Only a footer belonging to THIS pin counts. Pins nest (collection and
  // carousel ad units), so a plain querySelector reaches into a descendant
  // pin's footer — and when that nested footer comes first in document order,
  // it is returned INSTEAD of the pin's own, hiding a real ad label.
  const footer = Array.from(
    pinEl.querySelectorAll('[data-test-id="pinrep-footer"]')
  ).find((f) => f.closest(PIN_SELECTOR) === pinEl);
  if (!footer) return false;

  // Test elements one at a time rather than the footer's aggregate textContent:
  // that blob splices title, attribution and board name together with no
  // separator, which both matches author-written text and can form a keyword
  // across a sibling boundary that appears nowhere on screen. Each element's
  // full subtree text is used, not its leaf text, so a label split as
  // <span>Promoted</span><span> by Acme</span> still matches.
  return [footer, ...footer.querySelectorAll("*")].some((el) =>
    AD_LABEL_RE.test(normalize(el.textContent))
  );
}

function getOutlineTarget(pinEl) {
  // Outline the whole visible grid tile, not just the inner pin element,
  // so the red border wraps the full card the user sees.
  return pinEl.closest('[data-grid-item="true"]') || pinEl;
}

function scanAllPins() {
  // Resolve every tile's desired state first, then write once, so no element
  // is touched twice per pass with conflicting results.
  const adTargets = new Set();
  document.querySelectorAll(PIN_SELECTOR).forEach((pinEl) => {
    if (isAdPin(pinEl)) adTargets.add(getOutlineTarget(pinEl));
  });

  // A recycled tile can lose its pin entirely, leaving a marked tile that no
  // pin points at any more — unreachable from the loop above, so sweep it here.
  document.querySelectorAll(OUTLINE_SELECTOR).forEach((el) => {
    if (!adTargets.has(el)) el.classList.remove(OUTLINE_CLASS);
  });

  adTargets.forEach((el) => el.classList.add(OUTLINE_CLASS));
}

// Debounce so rapid-fire mutations during scroll don't trigger a full
// re-scan on every single DOM tweak.
let debounceHandle = null;
function scheduleScan() {
  if (debounceHandle) return;
  debounceHandle = setTimeout(() => {
    debounceHandle = null;
    scanAllPins();
  }, 150);
}

const observer = new MutationObserver(scheduleScan);
observer.observe(document.body, {
  childList: true,
  subtree: true,
});

// Initial pass in case pins are already rendered when the script loads.
scanAllPins();
