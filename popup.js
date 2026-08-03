document.addEventListener('DOMContentLoaded', () => {
  const urlList = document.getElementById('url-list');
  const addBtn = document.getElementById('add-btn');
  const addCurrentTabBtn = document.getElementById('add-current-tab');
  const addAllTabsBtn = document.getElementById('add-all-tabs');
  const openAllBtn = document.getElementById('open-all-btn');
  const inputUrl = document.getElementById('manual-url');

  let urlsArray = [];
  let draggedIndex = null;

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'local' && changes.urls) {
      const newUrls = changes.urls.newValue || [];
      if (JSON.stringify(newUrls) !== JSON.stringify(urlsArray)) {
        urlsArray = newUrls;
        renderList();
      }
    }
  });

  chrome.tabs.onActivated.addListener(() => {
    inspectActiveTabForGenericLinks();
  });

  chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (tab.active && (changeInfo.status === 'complete' || changeInfo.title)) {
      inspectActiveTabForGenericLinks(tab);
    }
  });

  function handleLinkClick(e) {
    e.preventDefault();
    const targetUrl = e.currentTarget.getAttribute('href');
    if (targetUrl) {
      chrome.tabs.create({ url: targetUrl, active: true });
    }
  }

  function normalizeUrl(urlString) {
    try {
      const parsed = new URL(urlString);
      const host = parsed.hostname.replace(/^www\./, '');
      let path = parsed.pathname;

      if (path.endsWith('/') && path.length > 1) {
        path = path.slice(0, -1);
      }

      return (host + path + parsed.search).toLowerCase();
    } catch (e) {
      return urlString.toLowerCase().replace(/^https?:\/\/(www\.)?/, '');
    }
  }

  function isRestrictedUrl(url) {
    if (!url) return true;
    return (
      url.startsWith('chrome://') ||
      url.startsWith('edge://') ||
      url.startsWith('about:') ||
      url.startsWith('chrome-extension://') ||
    );
  }

  function loadUrls() {
    chrome.storage.local.get({ urls: [] }, (data) => {
      urlsArray = data.urls || [];
      renderList();
      inspectActiveTabForGenericLinks();
    });
  }

  function inspectActiveTabForGenericLinks(activeTab = null) {
    if (!urlsArray.some(item => item.isGeneric)) return;

    const processTab = (tab) => {
      if (!tab || !tab.url || !tab.title) return;

      let updated = false;
      const activeBaseUrl = normalizeUrl(tab.url);

      urlsArray = urlsArray.map(item => {
        if (item.isGeneric && normalizeUrl(item.url) === activeBaseUrl) {
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
        renderList();
        saveData();
      }
    };

    if (activeTab) {
      processTab(activeTab);
    } else {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (!chrome.runtime.lastError && tabs && tabs[0]) {
          processTab(tabs[0]);
        }
      });
    }
  }

  function renderList() {
    urlList.innerHTML = '';
    const emptyState = document.getElementById('empty-state');

    if (urlsArray.length === 0) {
      if (emptyState) emptyState.style.display = 'block';
      return;
    } else {
      if (emptyState) emptyState.style.display = 'none';
    }

    urlsArray.forEach((item, index) => {
      const li = document.createElement('li');
      li.className = 'url-item';
      li.draggable = true;
      li.dataset.index = index;

      const contentDiv = document.createElement('div');
      contentDiv.className = 'url-content';

      const headerDiv = document.createElement('div');
      headerDiv.className = 'url-header';

      const faviconImg = document.createElement('img');
      faviconImg.className = 'favicon';
      faviconImg.src = `chrome-extension://${chrome.runtime.id}/_favicon/?pageUrl=${encodeURIComponent(item.url)}&size=32`;
      faviconImg.alt = '';

      const titleA = document.createElement('a');
      titleA.className = 'url-title url-link-clickable';
      titleA.href = item.url;

      // If generic, use the URL as the display text; otherwise, use the title
      const displayText = item.isGeneric ? item.url : item.title;
      titleA.textContent = displayText;
      titleA.title = displayText;

      titleA.addEventListener('click', handleLinkClick);

      headerDiv.appendChild(faviconImg);
      headerDiv.appendChild(titleA);

      contentDiv.appendChild(headerDiv);

      const actionsDiv = document.createElement('div');
      actionsDiv.className = 'url-actions';

      const copyBtn = document.createElement('button');
      copyBtn.className = 'action-btn copy-btn';
      copyBtn.textContent = 'Copy';
      copyBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(item.url);
        copyBtn.textContent = 'Copied!';
        setTimeout(() => copyBtn.textContent = 'Copy', 1500);
      });

      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'action-btn delete-btn';
      deleteBtn.innerHTML = '&#x2715;';
      deleteBtn.title = 'Delete';
      deleteBtn.addEventListener('click', () => {
        urlsArray.splice(index, 1);
        renderList();
        saveData();
      });

      actionsDiv.appendChild(copyBtn);
      actionsDiv.appendChild(deleteBtn);

      li.appendChild(contentDiv);
      li.appendChild(actionsDiv);

      li.addEventListener('dragstart', handleDragStart);
      li.addEventListener('dragover', handleDragOver);
      li.addEventListener('dragleave', handleDragLeave);
      li.addEventListener('drop', handleDrop);
      li.addEventListener('dragend', handleDragEnd);

      urlList.appendChild(li);
    });
  }

  function handleAdd() {
    let url = inputUrl.value.trim();
    if (url) {
      if (!/^https?:\/\//i.test(url)) {
        url = 'https://' + url;
      }

      urlsArray.push({
        id: crypto.randomUUID(),
        url: url,
        title: "Saved Link",
        isGeneric: true
      });
      renderList();
      saveData();
      inputUrl.value = '';
    }
  }

  addBtn.addEventListener('click', handleAdd);
  inputUrl.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handleAdd();
  });

  addCurrentTabBtn.addEventListener('click', () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const activeTab = tabs[0];
      if (activeTab && activeTab.url) {
        if (isRestrictedUrl(activeTab.url)) {
          alert('Cannot save browser system pages.');
          return;
        }
        urlsArray.push({
          id: crypto.randomUUID(),
          url: activeTab.url,
          title: activeTab.title || activeTab.url,
          isGeneric: false
        });
        renderList();
        saveData();
      }
    });
  });

  if (addAllTabsBtn) {
    addAllTabsBtn.addEventListener('click', () => {
      chrome.tabs.query({ currentWindow: true }, (tabs) => {
        if (!tabs || tabs.length === 0) return;

        let addedCount = 0;
        tabs.forEach((tab) => {
          if (tab.url && !isRestrictedUrl(tab.url)) {
            urlsArray.push({
              id: crypto.randomUUID(),
              url: tab.url,
              title: tab.title || tab.url,
              isGeneric: false
            });
            addedCount++;
          }
        });

        if (addedCount > 0) {
          renderList();
          saveData();
        }
      });
    });
  }

  openAllBtn.addEventListener('click', () => {
    if (urlsArray.length === 0) return;

    if (urlsArray.length > 15) {
      if (!confirm(`Are you sure you want to open ${urlsArray.length} tabs at once?`)) {
        return;
      }
    }

    urlsArray.forEach(item => {
      chrome.tabs.create({ url: item.url, active: false });
    });
  });

  function handleDragStart(e) {
    if (e.target.tagName === 'BUTTON' || e.target.tagName === 'A') {
      e.preventDefault();
      return;
    }
    draggedIndex = parseInt(this.dataset.index);
    e.dataTransfer.effectAllowed = 'move';
    setTimeout(() => this.classList.add('dragging'), 0);
  }

  function handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    this.classList.add('drag-over');
  }

  function handleDragLeave() {
    this.classList.remove('drag-over');
  }

  function handleDrop(e) {
    e.preventDefault();
    this.classList.remove('drag-over');

    const dropIndex = parseInt(this.dataset.index);
    if (draggedIndex !== null && draggedIndex !== dropIndex) {
      const [movedItem] = urlsArray.splice(draggedIndex, 1);
      urlsArray.splice(dropIndex, 0, movedItem);
      renderList();
      saveData();
    }
  }

  function handleDragEnd() {
    this.classList.remove('dragging');
  }

  function saveData() {
    chrome.storage.local.set({ urls: urlsArray });
  }

  loadUrls();
});
