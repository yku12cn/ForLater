import { isRestrictedUrl, normalizeUrl, createLinkItem } from './utils.js';

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
  const emptyState = document.getElementById('empty-state');

  let urlsArray = [];
  let draggedElement = null;
  let editingId = null;
  let hoverTimeout = null;
  let storageQueue = Promise.resolve();

  loadUrls();
  setupEventListeners();

  function setupEventListeners() {
    const handleListActivity = () => {
      window.clearTimeout(hoverTimeout);
      urlList.classList.add('is-hovering');
      hoverTimeout = setTimeout(() => urlList.classList.remove('is-hovering'), 500);
    };
    urlList.addEventListener('mouseover', handleListActivity);
    urlList.addEventListener('scroll', handleListActivity);

    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName === 'local' && changes.urls) {
        const newUrls = changes.urls.newValue || [];
        if (JSON.stringify(newUrls) !== JSON.stringify(urlsArray)) {
          urlsArray = newUrls;
          renderList();
        }
      }
    });

    chrome.tabs.onActivated.addListener(() => inspectActiveTabForGenericLinks());
    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
      if (tab.active && (changeInfo.status === 'complete' || changeInfo.title)) {
        inspectActiveTabForGenericLinks(tab);
      }
    });

    addBtn.addEventListener('click', handleAdd);
    inputUrl.addEventListener('keypress', (e) => e.key === 'Enter' && handleAdd());
    addCurrentTabBtn.addEventListener('click', handleAddCurrentTab);
    if (addAllTabsBtn) addAllTabsBtn.addEventListener('click', handleAddAllTabs);
    openAllBtn.addEventListener('click', handleOpenAll);

    if (searchInput) searchInput.addEventListener('input', debounce(applySearchFilter, 150));

    menuBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isExpanded = menuBtn.getAttribute('aria-expanded') === 'true';
      menuBtn.setAttribute('aria-expanded', String(!isExpanded));
      dropdownMenu.classList.toggle('hidden');
    });

    document.addEventListener('click', (e) => {
      if (!dropdownMenu.contains(e.target) && e.target !== menuBtn) {
        dropdownMenu.classList.add('hidden');
        menuBtn.setAttribute('aria-expanded', 'false');
      }
    });

    menuSave.addEventListener('click', handleExport);
    menuLoad.addEventListener('click', () => {
      fileInput.value = '';
      fileInput.click();
      dropdownMenu.classList.add('hidden');
      menuBtn.setAttribute('aria-expanded', 'false');
    });

    fileInput.addEventListener('change', handleImport);
    menuSortUrl.addEventListener('click', () => sortList((a, b) => a.url.localeCompare(b.url)));
    menuSortLabel.addEventListener('click', () => sortList((a, b) => {
      const labelA = a.isGeneric ? a.url : a.title;
      const labelB = b.isGeneric ? b.url : b.title;
      return labelA.localeCompare(labelB);
    }));

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
          addItems([linkInfo]);
        }
      }
    });
  }

  function addItems(newItems) {
    const validItems = newItems.filter(Boolean);
    if (!validItems.length) return;
    urlsArray.push(...validItems);
    renderList();
    saveData();
  }

  function saveData() {
    storageQueue = storageQueue.then(async () => {
      await chrome.storage.local.set({ urls: urlsArray });
    }).catch(err => console.error('Failed to save data:', err));
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
      if (!tab?.url || !tab?.title) return;
      let updated = false;
      const activeBaseUrl = normalizeUrl(tab.url);

      urlsArray = urlsArray.map(item => {
        if (item.isGeneric && normalizeUrl(item.url) === activeBaseUrl) {
          updated = true;
          return { ...item, title: tab.title, isGeneric: false };
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
        if (!chrome.runtime.lastError && tabs?.[0]) processTab(tabs[0]);
      });
    }
  }

  function renderList() {
    urlList.innerHTML = '';
    if (emptyState) emptyState.style.display = urlsArray.length === 0 ? 'block' : 'none';

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
    faviconImg.alt = '';

    const titleA = template.querySelector('.url-title');
    titleA.href = item.url;
    const displayText = item.isGeneric ? item.url : item.title;
    titleA.textContent = displayText;
    titleA.title = displayText;
    titleA.addEventListener('click', (e) => {
      e.preventDefault();
      chrome.tabs.create({ url: item.url, active: true });
    });

    const copyBtn = template.querySelector('.copy-btn');
    copyBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      navigator.clipboard.writeText(item.url);
      copyBtn.textContent = 'Copied!';
      setTimeout(() => (copyBtn.textContent = 'Copy'), 1500);
    });

    const deleteBtn = template.querySelector('.delete-btn');
    deleteBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      urlsArray = urlsArray.filter(u => u.id !== item.id);
      renderList();
      saveData();
    });

    li.appendChild(template);
    li.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      editingId = item.id;
      renderList();
    });

    li.addEventListener('dragstart', handleDragStart);
    li.addEventListener('dragover', handleDragOver);
    li.addEventListener('drop', (e) => e.preventDefault());
    li.addEventListener('dragend', handleDragEnd);
  }

  function renderEditCard(li, item) {
    li.classList.add('editing');
    li.draggable = false;

    const template = document.getElementById('url-edit-template').content.cloneNode(true);
    const labelInput = template.querySelector('.text-input');
    const urlInput = template.querySelector('.url-input');

    labelInput.value = item.isGeneric ? '' : item.title;
    urlInput.value = item.url;

    const performSave = () => {
      const trimmedLabel = labelInput.value.trim();
      const trimmedUrl = urlInput.value.trim();
      if (!trimmedUrl) return;

      const itemIdx = urlsArray.findIndex(u => u.id === item.id);
      if (itemIdx !== -1) {
        const newItem = createLinkItem(trimmedUrl, trimmedLabel || 'Saved Link', !trimmedLabel);
        if (newItem) {
          urlsArray[itemIdx] = { ...newItem, id: item.id };
          editingId = null;
          renderList();
          saveData();
        } else {
          alert('Please enter a valid URL.');
        }
      }
    };

    template.querySelector('.btn-cancel').addEventListener('click', () => {
      editingId = null;
      renderList();
    });

    template.querySelector('.btn-save').addEventListener('click', performSave);

    const handleKey = (e) => {
      if (e.key === 'Enter') performSave();
      if (e.key === 'Escape') { editingId = null; renderList(); }
    };

    labelInput.addEventListener('keydown', handleKey);
    urlInput.addEventListener('keydown', handleKey);

    li.appendChild(template);
    setTimeout(() => labelInput.focus(), 50);
  }

  function handleAdd() {
    const url = inputUrl.value.trim();
    if (url) {
      const item = createLinkItem(url);
      if (item) {
        addItems([item]);
        inputUrl.value = '';
      } else {
        alert('Please enter a valid HTTP or HTTPS URL.');
      }
    }
  }

  function handleAddCurrentTab() {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const activeTab = tabs[0];
      if (activeTab?.url) {
        if (isRestrictedUrl(activeTab.url)) {
          alert('Cannot save browser system pages.');
          return;
        }
        const item = createLinkItem(activeTab.url, activeTab.title, false);
        if (item) addItems([item]);
      }
    });
  }

  function handleAddAllTabs() {
    chrome.tabs.query({ currentWindow: true }, (tabs) => {
      if (!tabs?.length) return;
      const validItems = tabs
        .filter(tab => tab.url && !isRestrictedUrl(tab.url))
        .map(tab => createLinkItem(tab.url, tab.title, false))
        .filter(Boolean);

      addItems(validItems);
    });
  }

  function handleOpenAll() {
    if (!urlsArray.length) return;
    if (urlsArray.length > 15 && !confirm(`Are you sure you want to open ${urlsArray.length} tabs at once?`)) {
      return;
    }
    urlsArray.forEach(item => chrome.tabs.create({ url: item.url, active: false }));
  }

  function applySearchFilter() {
    const query = searchInput ? searchInput.value.trim().toLowerCase() : '';
    const items = urlList.querySelectorAll('.url-item:not(.editing)');

    items.forEach(li => {
      const item = urlsArray.find(u => u.id === li.dataset.id);
      if (!item) return;

      const titleA = li.querySelector('.url-title');
      const titleText = item.isGeneric ? item.url : item.title;
      const matches = query && (item.title.toLowerCase().includes(query) || item.url.toLowerCase().includes(query));

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
    element.innerHTML = '';
    const lowerText = text.toLowerCase();
    let lastIdx = 0;
    let pos = lowerText.indexOf(query);

    while (pos !== -1) {
      if (pos > lastIdx) element.appendChild(document.createTextNode(text.substring(lastIdx, pos)));
      const mark = document.createElement('mark');
      mark.className = 'search-match';
      mark.textContent = text.substring(pos, pos + query.length);
      element.appendChild(mark);

      lastIdx = pos + query.length;
      pos = lowerText.indexOf(query, lastIdx);
    }

    if (lastIdx < text.length) element.appendChild(document.createTextNode(text.substring(lastIdx)));
  }

  function extractDraggedLinkInfo(dataTransfer) {
    const rawUrl = dataTransfer.getData('text/uri-list') || dataTransfer.getData('text/plain');
    if (!rawUrl) return null;

    const cleanUrl = rawUrl.trim().split('\r\n')[0].split('\n')[0];
    let extractedTitle = null;

    const htmlData = dataTransfer.getData('text/html');
    if (htmlData) {
      try {
        const doc = new DOMParser().parseFromString(htmlData, 'text/html');
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

    return createLinkItem(cleanUrl, extractedTitle, !extractedTitle);
  }

  function handleDragStart(e) {
    if (['BUTTON', 'A', 'INPUT'].includes(e.target.tagName)) {
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

    if (draggedIdx < targetIdx && offsetY < rect.height * thresholdFraction) return;
    if (draggedIdx > targetIdx && offsetY > rect.height * (1 - thresholdFraction)) return;

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
        item.offsetHeight; // Force layout reflow
        item.style.transition = 'transform 0.2s ease';
        item.style.transform = '';
      }
    });
  }

  function handleDragEnd() {
    this.classList.remove('dragging');
    draggedElement = null;

    urlsArray = Array.from(urlList.children)
      .map(li => urlsArray.find(u => u.id === li.dataset.id))
      .filter(Boolean);

    saveData();
  }

  function handleExport() {
    const jsonString = JSON.stringify(urlsArray, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `forlater_backup_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    dropdownMenu.classList.add('hidden');
    menuBtn.setAttribute('aria-expanded', 'false');
  }

  function handleImport(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const importedData = JSON.parse(event.target.result);
        if (Array.isArray(importedData)) {
          urlsArray = importedData
            .map(item => item.url ? createLinkItem(item.url, item.title, typeof item.isGeneric === 'boolean' ? item.isGeneric : true) : null)
            .filter(Boolean);
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
  }

  function sortList(compareFn) {
    urlsArray.sort(compareFn);
    renderList();
    saveData();
    dropdownMenu.classList.add('hidden');
    menuBtn.setAttribute('aria-expanded', 'false');
  }

  function debounce(fn, delay = 150) {
    let timeout;
    return (...args) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => fn(...args), delay);
    };
  }
});