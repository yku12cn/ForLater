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

            // 1. Try currently hovered element
            const hoveredElements = Array.from(document.querySelectorAll(':hover')).reverse();
            for (const hoveredEl of hoveredElements) {
              const anchor = hoveredEl.closest('a');
              if (anchor && anchor.href === urlToFind) {
                const hoverText = extractText(anchor);
                if (hoverText) return hoverText;
              }
            }

            // 2. Fallback: Search DOM for anchor tag matching target URL
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

function isRestrictedUrl(url) {
  if (!url) return true;
  return (
    url.startsWith("chrome://") ||
    url.startsWith("edge://") ||
    url.startsWith("about:") ||
    url.startsWith("chrome-extension://") ||
  );
}

async function saveUrl(url, title, isGeneric = true) {
  const data = await chrome.storage.local.get({ urls: [] });
  const urls = data.urls;
  urls.push({
    id: crypto.randomUUID(),
    url: url,
    title: title,
    isGeneric: isGeneric
  });
  await chrome.storage.local.set({ urls });
}
