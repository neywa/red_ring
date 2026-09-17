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
 */

const AD_KEYWORDS = ["sponsored", "promoted"];
const PIN_SELECTOR = '[data-test-id="pin"]';
const OUTLINE_CLASS = "pam-ad-outline";

function isAdPin(pinEl) {
  const footer = pinEl.querySelector('[data-test-id="pinrep-footer"]');
  const text = (footer ? footer.textContent : pinEl.textContent) || "";
  const lower = text.toLowerCase();
  return AD_KEYWORDS.some((kw) => lower.includes(kw));
}

function getOutlineTarget(pinEl) {
  // Outline the whole visible grid tile, not just the inner pin element,
  // so the red border wraps the full card the user sees.
  return pinEl.closest('[data-grid-item="true"]') || pinEl;
}

function applyMarking(pinEl) {
  const target = getOutlineTarget(pinEl);
  target.classList.toggle(OUTLINE_CLASS, isAdPin(pinEl));
}

function scanAllPins() {
  document.querySelectorAll(PIN_SELECTOR).forEach(applyMarking);
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
