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

const AD_KEYWORDS = ["sponsored", "promoted"];
const PIN_SELECTOR = '[data-test-id="pin"]';
const OUTLINE_CLASS = "pam-ad-outline";
const OUTLINE_SELECTOR = `.${OUTLINE_CLASS}`;

function isAdPin(pinEl) {
  // Only Pinterest's own footer label counts. Matching the pin's whole text
  // would flag any pin whose title or description mentions an ad keyword.
  const footer = pinEl.querySelector('[data-test-id="pinrep-footer"]');
  if (!footer) return false;
  const lower = (footer.textContent || "").toLowerCase();
  return AD_KEYWORDS.some((kw) => lower.includes(kw));
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
  characterData: true,
});

// Initial pass in case pins are already rendered when the script loads.
scanAllPins();
