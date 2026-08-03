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

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "ForLater-page") {
    saveUrl(info.pageUrl, tab.title, false);
  }
  else if (info.menuItemId === "ForLater-link") {
    const linkUrl = info.linkUrl;

    chrome.tabs.sendMessage(tab.id, { action: "getTargetTitle", linkUrl: linkUrl }, (response) => {
      let title = null;
      if (chrome.runtime.lastError) {
        title = info.selectionText;
      } else if (response && response.title) {
        title = response.title;
      }
      if (!title) {
        saveUrl(linkUrl, "Saved Link", true);
      } else {
        saveUrl(linkUrl, title, false);
      }
    });
  }
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url && tab.title) {
    chrome.storage.local.get({ urls: [] }, (data) => {
      let urls = data.urls;
      let updated = false;

      urls = urls.map(item => {
        if (item.isGeneric && item.url === tab.url) {
          updated = true;
          return {
            ...item,
            title: tab.title,
            isGeneric: false
          };
        }
        return item;
      });

      if (updated) {
        chrome.storage.local.set({ urls });
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