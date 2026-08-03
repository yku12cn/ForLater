let lastClickedElement = null;

// Track the exact element the user right-clicked
document.addEventListener('mousedown', (event) => {
  if (event.button === 2) {
    lastClickedElement = event.target;
  }
}, true);

// Listen for requests from the background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "getTargetTitle") {
    let title = extractTitleFromElement(lastClickedElement, request.linkUrl);
    sendResponse({ title: title });
  }
});

function extractTitleFromElement(targetEl, linkUrl) {
  if (!targetEl) return null;

  let a = targetEl.closest('a');

  if (!a && linkUrl) {
    a = targetEl.querySelector('a') || targetEl.closest('div');
  }

  if (a && a.tagName === 'A') {
    let directText = (a.innerText || "").trim();
    if (!directText) {
      directText = (a.getAttribute('aria-label') || a.title || "").trim();
    }
    if (!directText) {
      const img = a.querySelector('img');
      if (img) directText = (img.alt || img.title || "").trim();
    }
    if (directText) {
      return directText;
    }
  }

  // If no direct text, trace back from the clicked element/anchor up for a text string.
  let currentParent = targetEl;

  for (let i = 0; i < 4; i++) {
    if (!currentParent) break;

    let pText = (currentParent.getAttribute('title') || currentParent.innerText || "").trim();
    if (pText) {
      return pText;
    }
    currentParent = currentParent.parentElement;
  }
  return null;
}
