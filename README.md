# ForLater <img src="extension/icons/icon128.png" align="right" height="138" alt="ForLater" /></a>

[![Manifest V3](https://img.shields.io/badge/Manifest-V3-blue.svg)](https://developer.chrome.com/docs/extensions/mv3/intro/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)

**ForLater** is a lightweight, clean Chrome extension designed to save web links for later.

---

## Features

* **Save Current Tab:** Instantly save the tab you are currently viewing.
* **Save All Tabs:** Instantly save all tabs in the current window.
* **Save target link:** Right-click any link on a webpage to save it.
* **Save raw URL:** Paste raw URLs directly into the extension's input field.
* **Reordering:** Easily rearrange your saved list to fit your reading priority.
* **Quick Actions:** Copy URLs to your clipboard or delete items with a single click.

---

## Installation & Setup

### From Chrome Store

1. Install [ForLater](https://chromewebstore.google.com/detail/ggammfdodcfmcfnnfgnlmikhpobnnkin)

### Installation (Developer / Unpacked Mode)

1. **Clone or Download** this repository
2. Open Google Chrome and navigate to `chrome://extensions/`.
3. Enable **Developer mode** using the toggle in the top-right corner.
4. Click **Load unpacked** and select the directory containing `manifest.json`.
5. Open a new tab to see **ForLater** in action! 🎉

---

## Directory Structure

```text
ForLater/
└── Extension               # Main folder for the extension
    ├── manifest.json       # Extension configuration (Manifest V3)
    ├── background.js       # Service worker managing context menus and link adding logic
    ├── popup.html          # Main GUI HTML markup
    ├── popup.js            # Handles user interactions, list rendering, list editing and drag-and-drop sorting
    ├── popup.css           # Material styling
    └── icons/              # Extension icons (16x16, 48x48, 128x128)
        ├── icon16.png
        ├── icon48.png
        └── icon128.png
```

---