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
  .catch((error) => console.error(error));

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "ForLater-page") {
    saveUrl(info.pageUrl, tab.title, false);
  }
  else if (info.menuItemId === "ForLater-link") {
    const linkUrl = info.linkUrl;

    chrome.scripting.executeScript({
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

        // Find the element currently in the :hover state
        const hoveredElements = Array.from(document.querySelectorAll(':hover')).reverse();

        for (const hoveredEl of hoveredElements) {
          const anchor = hoveredEl.closest('a');
          if (anchor && anchor.href === urlToFind) {
            const hoverText = extractText(anchor);
            if (hoverText) return hoverText;
          }
        }

        return null;
      },
      args: [linkUrl]
    }, (injectionResults) => {
      let title = info.selectionText;

      if (!chrome.runtime.lastError && injectionResults && injectionResults[0]?.result) {
        title = injectionResults[0].result;
      }

      if (title) {
        saveUrl(linkUrl, title, false);
      } else {
        saveUrl(linkUrl, "Saved Link", true);
      }

    });
  }
});

function saveUrl(url, title, isGeneric = true) {
  chrome.storage.local.get({ urls: [] }, (data) => {
    const urls = data.urls;
    urls.push({
      id: Date.now().toString(),
      url: url,
      title: title,
      isGeneric: isGeneric
    });
    chrome.storage.local.set({ urls });
  });
}