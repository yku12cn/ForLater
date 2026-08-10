document.addEventListener('DOMContentLoaded', () => {
  const urlList = document.getElementById('url-list');
  const addBtn = document.getElementById('add-btn');
  const addCurrentTabBtn = document.getElementById('add-current-tab');
  const addAllTabsBtn = document.getElementById('add-all-tabs');
  const openAllBtn = document.getElementById('open-all-btn');
  const inputUrl = document.getElementById('manual-url');
  const searchInput = document.getElementById('search-input');
  const appContainer = document.querySelector('.app-container');
  const menuBtn = document.getElementById('menu-btn');
  const dropdownMenu = document.getElementById('dropdown-menu');
  const menuSave = document.getElementById('menu-save');
  const menuLoad = document.getElementById('menu-load');
  const menuSortUrl = document.getElementById('menu-sort-url');
  const menuSortLabel = document.getElementById('menu-sort-label');
  const fileInput = document.getElementById('file-input');

  let urlsArray = [];
  let draggedElement = null;
  let editingId = null;
  let isHovering;

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
      url.startsWith('chrome-extension://')
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

    const mouseDetector = () => {
      window.clearTimeout(isHovering);
      urlList.classList.add('is-hovering');
      isHovering = setTimeout(() => {
        urlList.classList.remove('is-hovering');
      }, 500);
    }
    urlList.addEventListener('mouseover', mouseDetector);
    urlList.addEventListener('scroll', mouseDetector);

    if (urlsArray.length === 0) {
      if (emptyState) emptyState.style.display = 'block';
      return;
    } else {
      if (emptyState) emptyState.style.display = 'none';
    }

    urlsArray.forEach((item) => {
      const li = document.createElement('li');
      li.className = 'url-item';
      li.dataset.id = item.id;

      if (editingId === item.id) {
        renderEditCard(li, item);
      } else {
        renderNormalCard(li, item);
      }

      urlList.appendChild(li);
    });

    applySearchFilter();
  }

  function renderNormalCard(li, item) {
    li.draggable = true;
    const template = document.getElementById('url-card-template').content.cloneNode(true);

    const faviconImg = template.querySelector('.favicon');
    faviconImg.src = `chrome-extension://${chrome.runtime.id}/_favicon/?pageUrl=${encodeURIComponent(item.url)}&size=32`;

    const titleA = template.querySelector('.url-title');
    titleA.href = item.url;

    const displayText = item.isGeneric ? item.url : item.title;
    titleA.textContent = displayText;
    titleA.title = displayText;
    titleA.addEventListener('click', handleLinkClick);

    const copyBtn = template.querySelector('.copy-btn');
    copyBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      navigator.clipboard.writeText(item.url);
      copyBtn.textContent = 'Copied!';
      setTimeout(() => copyBtn.textContent = 'Copy', 1500);
    });

    const deleteBtn = template.querySelector('.delete-btn');
    deleteBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const itemIdx = urlsArray.findIndex(u => u.id === item.id);
      if (itemIdx !== -1) {
        urlsArray.splice(itemIdx, 1);
        renderList();
        saveData();
      }
    });

    li.appendChild(template);

    li.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      editingId = item.id;
      renderList();
    });

    li.addEventListener('dragstart', handleDragStart);
    li.addEventListener('dragover', handleDragOver);
    li.addEventListener('drop', handleDrop);
    li.addEventListener('dragend', handleDragEnd);
  }

  function renderEditCard(li, item) {
    li.classList.add('editing');
    li.draggable = false;

    const template = document.getElementById('url-edit-template').content.cloneNode(true);
    const labelInput = template.querySelector('.text-input');
    const urlInput = template.querySelector('.url-input');
    const cancelBtn = template.querySelector('.btn-cancel');
    const saveBtn = template.querySelector('.btn-save');

    labelInput.value = item.isGeneric ? '' : item.title;
    urlInput.value = item.url;

    cancelBtn.addEventListener('click', () => {
      editingId = null;
      renderList();
    });

    const performSave = () => {
      let trimmedLabel = labelInput.value.trim();
      let trimmedUrl = urlInput.value.trim();

      if (!trimmedUrl) return;

      if (!/^https?:\/\//i.test(trimmedUrl)) {
        trimmedUrl = 'https://' + trimmedUrl;
      }

      const itemIdx = urlsArray.findIndex(u => u.id === item.id);
      if (itemIdx !== -1) {
        if (trimmedLabel === '') {
          urlsArray[itemIdx].title = 'Saved Link';
          urlsArray[itemIdx].isGeneric = true;
        } else {
          urlsArray[itemIdx].title = trimmedLabel;
          urlsArray[itemIdx].isGeneric = false;
        }
        urlsArray[itemIdx].url = trimmedUrl;

        editingId = null;
        renderList();
        saveData();
      }
    };

    saveBtn.addEventListener('click', performSave);

    labelInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') performSave();
      if (e.key === 'Escape') { editingId = null; renderList(); }
    });

    urlInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') performSave();
      if (e.key === 'Escape') { editingId = null; renderList(); }
    });

    li.appendChild(template);

    setTimeout(() => labelInput.focus(), 50);
  }

  if (searchInput) {
    searchInput.addEventListener('input', applySearchFilter);
  }

  function applySearchFilter() {
    const query = searchInput ? searchInput.value.trim().toLowerCase() : '';
    const items = urlList.querySelectorAll('.url-item:not(.editing)');

    items.forEach(li => {
      const id = li.dataset.id;
      const item = urlsArray.find(u => u.id === id);
      if (!item) return;

      const titleA = li.querySelector('.url-title');
      const titleText = item.isGeneric ? item.url : item.title;

      const matches = query && (
        item.title.toLowerCase().includes(query) ||
        item.url.toLowerCase().includes(query)
      );

      if (matches) {
        li.classList.add('highlighted');
        if (titleA) highlightTextNode(titleA, titleText, query);
      } else {
        li.classList.remove('highlighted');
        if (titleA) titleA.textContent = titleText;
      }
    });
  }

  function highlightTextNode(element, text, query) {
    if (!query) {
      element.textContent = text;
      return;
    }
    const lowerText = text.toLowerCase();
    element.innerHTML = '';

    let lastIdx = 0;
    let pos = lowerText.indexOf(query);

    while (pos !== -1) {
      if (pos > lastIdx) {
        element.appendChild(document.createTextNode(text.substring(lastIdx, pos)));
      }
      const mark = document.createElement('mark');
      mark.className = 'search-match';
      mark.textContent = text.substring(pos, pos + query.length);
      element.appendChild(mark);

      lastIdx = pos + query.length;
      pos = lowerText.indexOf(query, lastIdx);
    }

    if (lastIdx < text.length) {
      element.appendChild(document.createTextNode(text.substring(lastIdx)));
    }
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

  appContainer.addEventListener('dragover', (e) => {
    if (!draggedElement) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
    }
  });

  function extractDraggedLinkInfo(dataTransfer) {
    const rawUrl = dataTransfer.getData('text/uri-list') || dataTransfer.getData('text/plain');
    if (!rawUrl || !/^https?:\/\//i.test(rawUrl.trim())) return null;

    const cleanUrl = rawUrl.trim().split('\r\n')[0].split('\n')[0];
    let extractedTitle = null;

    const htmlData = dataTransfer.getData('text/html');
    if (htmlData) {
      try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(htmlData, 'text/html');
        const anchor = doc.querySelector('a');
        if (anchor) {
          extractedTitle = (anchor.innerText || anchor.getAttribute('aria-label') || anchor.title || '').trim();
          if (!extractedTitle) {
            const img = anchor.querySelector('img');
            if (img) extractedTitle = (img.alt || img.title || '').trim();
          }
        }
      } catch (err) {
        console.warn('Failed to parse dropped HTML data:', err);
      }
    }

    if (!extractedTitle) {
      const plainText = dataTransfer.getData('text/plain')?.trim();
      if (plainText && plainText !== cleanUrl && !/^https?:\/\//i.test(plainText)) {
        extractedTitle = plainText;
      }
    }

    return {
      url: cleanUrl,
      title: extractedTitle || "Saved Link",
      isGeneric: !extractedTitle
    };
  }

  appContainer.addEventListener('dragover', (e) => {
    if (!draggedElement) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
    }
  });

  appContainer.addEventListener('drop', (e) => {
    if (!draggedElement) {
      e.preventDefault();
      const linkInfo = extractDraggedLinkInfo(e.dataTransfer);

      if (linkInfo) {
        urlsArray.push({
          id: crypto.randomUUID(),
          url: linkInfo.url,
          title: linkInfo.title,
          isGeneric: linkInfo.isGeneric
        });
        renderList();
        saveData();
      }
    }
  });

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

  function saveData() {
    chrome.storage.local.set({ urls: urlsArray });
  }

  function handleDragStart(e) {
    if (e.target.tagName === 'BUTTON' || e.target.tagName === 'A' || e.target.tagName === 'INPUT') {
      e.preventDefault();
      return;
    }
    draggedElement = this;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', '');
    setTimeout(() => this.classList.add('dragging'), 0);
  }

  function handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';

    if (!draggedElement || draggedElement === this) return;

    const items = Array.from(urlList.children);
    const draggedIdx = items.indexOf(draggedElement);
    const targetIdx = items.indexOf(this);

    if (draggedIdx === -1 || targetIdx === -1 || draggedIdx === targetIdx) return;

    const rect = this.getBoundingClientRect();
    const offsetY = e.clientY - rect.top;
    const thresholdFraction = 0.65;

    if (draggedIdx < targetIdx) {
      if (offsetY < rect.height * thresholdFraction) return;
    } else {
      if (offsetY > rect.height * (1 - thresholdFraction)) return;
    }

    const firstPositions = new Map();
    items.forEach(item => {
      firstPositions.set(item, item.getBoundingClientRect().top);
    });

    if (draggedIdx < targetIdx) {
      this.after(draggedElement);
    } else {
      this.before(draggedElement);
    }

    const updatedItems = Array.from(urlList.children);
    updatedItems.forEach(item => {
      if (item === draggedElement) return;

      const firstTop = firstPositions.get(item);
      const lastTop = item.getBoundingClientRect().top;
      const deltaY = firstTop - lastTop;

      if (deltaY !== 0) {
        item.style.transition = 'none';
        item.style.transform = `translateY(${deltaY}px)`;

        item.offsetHeight;
        item.style.transition = 'transform 0.2s ease';
        item.style.transform = '';
      }
    });
  }

  function handleDrop(e) {
    e.preventDefault();
  }

  function handleDragEnd() {
    this.classList.remove('dragging');
    draggedElement = null;

    const newUrls = [];
    Array.from(urlList.children).forEach(li => {
      const id = li.dataset.id;
      const item = urlsArray.find(u => u.id === id);
      if (item) newUrls.push(item);
    });

    urlsArray = newUrls;
    saveData();
  }

  loadUrls();

  menuBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    dropdownMenu.classList.toggle('hidden');
  });

  document.addEventListener('click', (e) => {
    if (!dropdownMenu.contains(e.target) && e.target !== menuBtn) {
      dropdownMenu.classList.add('hidden');
    }
  });

  menuSave.addEventListener('click', () => {
    const jsonString = JSON.stringify(urlsArray, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `forlater_backup_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();

    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    dropdownMenu.classList.add('hidden');
  });

  menuLoad.addEventListener('click', () => {
    fileInput.value = '';
    fileInput.click();
    dropdownMenu.classList.add('hidden');
  });

  fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const importedData = JSON.parse(event.target.result);
        if (Array.isArray(importedData)) {
          urlsArray = importedData.map(item => ({
            id: item.id || crypto.randomUUID(),
            url: item.url || '',
            title: item.title || item.url || 'Saved Link',
            isGeneric: typeof item.isGeneric === 'boolean' ? item.isGeneric : true
          })).filter(item => item.url !== '');

          renderList();
          saveData();
        } else {
          alert('Invalid JSON format: Expected an array of link objects.');
        }
      } catch (err) {
        alert('Failed to parse JSON file: ' + err.message);
      }
    };
    reader.readAsText(file);
  });

  menuSortUrl.addEventListener('click', () => {
    urlsArray.sort((a, b) => a.url.localeCompare(b.url));
    renderList();
    saveData();
    dropdownMenu.classList.add('hidden');
  });

  menuSortLabel.addEventListener('click', () => {
    urlsArray.sort((a, b) => {
      const labelA = a.isGeneric ? a.url : a.title;
      const labelB = b.isGeneric ? b.url : b.title;
      return labelA.localeCompare(labelB);
    });
    renderList();
    saveData();
    dropdownMenu.classList.add('hidden');
  });

});
