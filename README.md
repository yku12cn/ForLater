![ICON](./icons/icon128.png)
# ForLater Extension

A lightweight, clean Chrome extension designed to save web links for later.

## Features

* **Save Current Page:** Instantly save the tab you are currently viewing.
* **Save target link:** Right-click any link on a webpage to save it.
* **Save raw URL:** Paste raw URLs directly into the extension's input field.
* **Reordering:** Easily rearrange your saved list to fit your reading priority.
* **Quick Actions:** Copy URLs to your clipboard or delete items with a single click.

---

## Installation & Setup

### From Chrome Store

TBD

### Loacl Installation

1. Clone or download this repository to your local machine.
2. Open Google Chrome and navigate to `chrome://extensions/`.
3. Enable **Developer mode** using the toggle switch in the top-right corner.
4. Click the **Load unpacked** button in the top-left corner.
5. Select the folder containing your extension files.

---

## File Structure

* `manifest.json` — Extension configuration and permissions setup.
* `background.js` — Service worker managing context menus and link upgrading logic.
* `content.js` — Lightweight content script for precision element targeting on right-clicks.
* `popup.html` — The HTML markup for the extension GUI.
* `popup.js` — Handles user interactions, list rendering, and drag-and-drop sorting.
* `popup.css` — Material Dark styling with bright orange accents.
