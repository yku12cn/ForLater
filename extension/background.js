import { isRestrictedUrl, createLinkItem } from './utils.js';

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "ForLater-link",
    title: "Save link for later",
    contexts: ["link"]
  });

  chrome.contextMenus.create({
    id: "ForLater-page",
    title: "Save page for later",
    contexts: ["page"]
  });
});

chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error) => console.error("Side panel setup failed:", error));

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === "ForLater-page") {
    const title = tab?.title || info.pageUrl;
    await saveUrl(info.pageUrl, title, false);
  } else if (info.menuItemId === "ForLater-link") {
    const linkUrl = info.linkUrl;
    let title = info.selectionText || null;

    if (tab?.id && !isRestrictedUrl(tab.url)) {
      try {
        const injectionResults = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: (urlToFind) => {
            const extractText = (el) => {
              if (!el) return null;
              let text = (el.innerText || el.getAttribute('aria-label') || el.title || "").trim();
              if (!text) {
                const img = el.querySelector('img');
                if (img) text = (img.alt || img.title || "").trim();
              }
              return text || null;
            };

            const hoveredElements = Array.from(document.querySelectorAll(':hover')).reverse();
            for (const hoveredEl of hoveredElements) {
              const anchor = hoveredEl.closest('a');
              if (anchor && anchor.href === urlToFind) {
                const hoverText = extractText(anchor);
                if (hoverText) return hoverText;
              }
            }

            const matchingAnchor = Array.from(document.querySelectorAll('a')).find(a => a.href === urlToFind);
            return matchingAnchor ? extractText(matchingAnchor) : null;
          },
          args: [linkUrl]
        });

        if (injectionResults?.[0]?.result) {
          title = injectionResults[0].result;
        }
      } catch (err) {
        console.warn("Could not execute script on current tab:", err);
      }
    }

    if (title) {
      await saveUrl(linkUrl, title, false);
    } else {
      await saveUrl(linkUrl, "Saved Link", true);
    }
  }
});

let storageQueue = Promise.resolve();

function saveUrl(url, title, isGeneric = true) {
  const item = createLinkItem(url, title, isGeneric);
  if (!item) return Promise.resolve();

  storageQueue = storageQueue.then(async () => {
    const data = await chrome.storage.local.get({ urls: [] });
    const urls = data.urls || [];
    urls.push(item);
    await chrome.storage.local.set({ urls });
  }).catch((err) => console.error("Failed to save URL to storage:", err));

  return storageQueue;
}