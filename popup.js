document.addEventListener('DOMContentLoaded', () => {
  const urlList = document.getElementById('url-list');
  const addBtn = document.getElementById('add-btn');
  const addCurrentTabBtn = document.getElementById('add-current-tab');
  const openAllBtn = document.getElementById('open-all-btn');
  const inputUrl = document.getElementById('manual-url');

  let urlsArray = [];
  let draggedIndex = null;

  function loadUrls() {
    chrome.storage.local.get({ urls: [] }, (data) => {
      urlsArray = data.urls;
      renderList();
    });
  }

  function renderList() {
    urlList.innerHTML = '';
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
      titleA.target = '_blank';
      titleA.textContent = item.title;
      titleA.title = item.title;

      headerDiv.appendChild(faviconImg);
      headerDiv.appendChild(titleA);

      const linkA = document.createElement('a');
      linkA.className = 'url-link';
      linkA.href = item.url;
      linkA.target = '_blank';
      linkA.textContent = item.url;
      linkA.title = item.url;

      contentDiv.appendChild(headerDiv);
      contentDiv.appendChild(linkA);

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
      deleteBtn.textContent = 'Delete';
      deleteBtn.addEventListener('click', () => {
        urlsArray.splice(index, 1);
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
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = 'https://' + url;
      }

      urlsArray.push({
        id: Date.now().toString(),
        url: url,
        title: "Saved Link",
        isGeneric: true
      });
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
        if (activeTab.url.startsWith('chrome://') || activeTab.url.startsWith('edge://')) {
          alert('Cannot save browser system pages.');
          return;
        }
        urlsArray.push({
          id: Date.now().toString(),
          url: activeTab.url,
          title: activeTab.title || activeTab.url,
          isGeneric: false
        });
        saveData();
      }
    });
  });

  openAllBtn.addEventListener('click', () => {
    if (urlsArray.length === 0) return;

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
      const item = urlsArray.splice(draggedIndex, 1)[0];
      urlsArray.splice(dropIndex, 0, item);
      saveData();
    }
  }

  function handleDragEnd() {
    this.classList.remove('dragging');
  }

  function saveData() {
    chrome.storage.local.set({ urls: urlsArray }, () => renderList());
  }

  loadUrls();
});
