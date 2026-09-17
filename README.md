# Red Ring — Pinterest Ad Marker

A small Chrome extension that draws a **red ring around every promoted ("sponsored") pin** on pinterest.com and puts a little **AD** chip in the corner, so you can tell ads apart from real pins at a glance.

No accounts, no servers, no tracking. It runs entirely in your browser and only on `pinterest.com`.

---

## Contents

- [Install it (the short version)](#install-it-the-short-version)
- [Step by step: Windows](#step-by-step-windows)
- [Step by step: macOS](#step-by-step-macos)
- [Step by step: Linux](#step-by-step-linux)
- [Check that it works](#check-that-it-works)
- [Updating to a newer version](#updating-to-a-newer-version)
- [Making your own .zip](#making-your-own-zip)
- [Troubleshooting](#troubleshooting)
- [How it works](#how-it-works)
- [For developers](#for-developers)

---

## Install it (the short version)

Chrome installs this kind of extension from a **folder on your disk**, not from a file. So the whole job is: download the code, unzip it, and point Chrome at the unzipped folder.

> **Important:** you cannot drag a `.zip` onto Chrome's extensions page and have it install. Only the Chrome Web Store or a signed `.crx` works that way. Unzipping first is not an optional step — it *is* the install.

Anything called "Chrome" below also applies to Edge, Brave, Opera, Vivaldi and other Chromium browsers; the extensions page is at the same address in each.

---

## Step by step: Windows

**1. Download the code**

- Go to https://github.com/neywa/red_ring
- Click the green **Code** button → **Download ZIP**.
- The file lands in your `Downloads` folder as `red_ring-main.zip`.

**2. Unzip it**

- Right-click `red_ring-main.zip` → **Extract All…** → **Extract**.
- You now have a folder named `red_ring-main`. Open it. If you see a *second* `red_ring-main` folder inside, go into that one.
- You are in the right folder when you can see the file **`manifest.json`** listed.
- Move that folder somewhere permanent — e.g. `C:\Users\<you>\Documents\red_ring`. **Chrome reads this folder every time it starts, so if you delete it or move it later, the extension breaks.**

**3. Load it into Chrome**

- Open Chrome and type `chrome://extensions` in the address bar, then Enter.
- Turn on **Developer mode** (toggle, top right).
- Click **Load unpacked** (top left).
- Navigate *into* your `red_ring` folder — the one where you can see `manifest.json` — and click **Select Folder**.

A card reading **Red Ring - Pinterest Ad Marker 1.0.1** appears. Done.

---

## Step by step: macOS

**1. Download the code**

- Go to https://github.com/neywa/red_ring
- Click the green **Code** button → **Download ZIP**.

**2. Unzip it**

- Double-click `red_ring-main.zip` in your `Downloads` folder. macOS unzips it into a folder named `red_ring-main` right next to it.
- Open the folder and confirm you can see **`manifest.json`**. If instead you see one more folder, go into it.
- Drag that folder somewhere permanent — e.g. your `Documents` folder. **Don't delete it afterwards**; Chrome loads the extension from this folder every time it starts.

**3. Load it into Chrome**

- Open Chrome, type `chrome://extensions` in the address bar, Enter.
- Turn on **Developer mode** (toggle, top right).
- Click **Load unpacked**.
- In the file chooser, go *into* the `red_ring` folder — you should see `manifest.json` — and click **Select**.

A card reading **Red Ring - Pinterest Ad Marker 1.0.1** appears. Done.

---

## Step by step: Linux

**1. Download the code** — either way works:

```bash
# Option A: git (keeps it easy to update later)
git clone https://github.com/neywa/red_ring.git ~/red_ring

# Option B: plain download, no git needed
cd ~
curl -L -o red_ring.zip https://github.com/neywa/red_ring/archive/refs/heads/main.zip
unzip red_ring.zip        # creates ~/red_ring-main
```

**2. Confirm you have the right folder**

```bash
ls ~/red_ring          # or ~/red_ring-main
# you should see: manifest.json  content.js  style.css  icon128.png
```

**3. Load it into Chrome**

- Open Chrome, go to `chrome://extensions`.
- Turn on **Developer mode** (toggle, top right).
- Click **Load unpacked**, navigate *into* the folder that contains `manifest.json`, and confirm.

A card reading **Red Ring - Pinterest Ad Marker 1.0.1** appears. Done.

> **Flatpak Chrome users:** a sandboxed Chrome reaches your files through the desktop "document portal", so the folder shows up under a path like `/run/flatpak/doc/<id>/red_ring` and that permission is granted per selection — it can expire when Chrome restarts, which shows up as *"Manifest file is missing or unreadable"*. Re-doing **Load unpacked** fixes it each time. To make it permanent instead:
>
> ```bash
> flatpak override --user --filesystem=/home/<you>/red_ring:ro com.google.Chrome
> ```

---

## Check that it works

1. Open https://www.pinterest.com and scroll your home feed.
2. Promoted pins — the ones whose footer says *Promoted* or *Promoted by …* — get a red outline and a small red **AD** badge in the top-left corner.
3. Everything else looks untouched.

If you scroll for a while and see no rings at all, that may simply mean Pinterest served you no ads. Scroll further before concluding it's broken, then see [Troubleshooting](#troubleshooting).

---

## Updating to a newer version

You do **not** need to uninstall anything.

- **If you used `git clone`:** run `git pull` in the folder, then go to `chrome://extensions` and click the **↻ reload** icon on the Red Ring card.
- **If you downloaded the ZIP:** download the new ZIP, unzip it, and replace the contents of your existing folder with the new files. Then click **↻ reload** on the card.

After reloading the extension, **hard-reload any open Pinterest tab** (`Ctrl+Shift+R`, or `Cmd+Shift+R` on macOS) — an already-open tab keeps running the old code until you do.

To remove the extension entirely, click **Remove** on its card in `chrome://extensions`, then delete the folder.

---

## Making your own .zip

A `.zip` is useful for backing up a known-good copy or sending it to someone — **not** for installing, since Chrome still needs an unpacked folder at the other end (the recipient unzips it and does *Load unpacked*, exactly as above).

The one rule: **`manifest.json` must sit at the top level inside the zip**, not one folder down. Zip the *contents*, not the containing folder.

The extension is only these four files — `test/`, `node_modules/` and any older `.zip` are not part of it and should be left out.

**Windows (PowerShell)** — run from inside the extension folder:

```powershell
Compress-Archive -Path manifest.json,content.js,style.css,icon128.png -DestinationPath red_ring-1.0.1.zip
```

*(Right-click → "Send to → Compressed (zipped) folder" also works, but select the four files themselves, not the folder they're in.)*

**macOS** — in Finder, select the four files (not the folder), right-click → **Compress 4 Items**, then rename `Archive.zip`. Or in Terminal, from inside the folder:

```bash
zip red_ring-1.0.1.zip manifest.json content.js style.css icon128.png
```

**Linux** — from inside the folder:

```bash
zip red_ring-1.0.1.zip manifest.json content.js style.css icon128.png
```

Verify the layout before sharing it — the four names should appear bare, with no folder prefix:

```bash
unzip -l red_ring-1.0.1.zip
```

If you bump the version, edit `"version"` in `manifest.json` first so the number in the zip name and the number Chrome displays agree.

---

## Troubleshooting

**"Manifest file is missing or unreadable"**
You picked the wrong folder — most likely the one *containing* the extension rather than the extension itself. Redo **Load unpacked** and go one level deeper, until the chooser lists `manifest.json`. On Flatpak Chrome this error can also appear after a restart even when nothing changed; see the note in the Linux section.

**The card is there, but no pin ever gets a ring**
Hard-reload the Pinterest tab (`Ctrl+Shift+R` / `Cmd+Shift+R`). A tab that was already open when you installed the extension is still running without it.

**Still nothing after a hard reload**
Pinterest changes its own markup from time to time, and this extension keys off two specific things: an element with `data-test-id="pinrep-footer"`, and a label reading exactly *Promoted*, *Sponsored*, or *Promoted by …*. If either changes, the extension marks nothing. That's deliberate — see [How it works](#how-it-works). Open DevTools (`F12`) on the Pinterest tab, inspect a promoted pin's footer, and check whether that label still reads the way it used to.

**A normal pin got outlined by mistake**
That shouldn't happen — please [open an issue](https://github.com/neywa/red_ring/issues) with a screenshot and, if you can, the pin's footer HTML from DevTools.

**Chrome nags "Disable developer mode extensions" at startup**
Normal for any unpacked extension. Dismiss it; the extension keeps working.

---

## How it works

The whole extension is one content script plus a stylesheet, injected on `*://*.pinterest.com/*`.

- **Detection is deliberately strict.** A pin counts as an ad only when its *own* footer contains an element whose entire text reads *Promoted*, *Sponsored*, or *Promoted by …*. Matching the footer's text as a whole instead would flag a pin merely *titled* "Sponsored hiking gear roundup", or one saved to a board called "Promoted Kitchens" — author-written text lives in that same footer.
- **When in doubt, it marks nothing.** If Pinterest renames a selector or rewords the label, the extension quietly stops marking pins rather than starting to outline the wrong ones. A missed ad is a much cheaper mistake than a false accusation against someone's pin.
- **It re-checks constantly.** Pinterest's feed recycles DOM nodes as you scroll — the same tile that held an ad a moment ago may hold an ordinary pin next. So the script re-evaluates what each tile currently contains and adds *or removes* the ring to match, rather than marking anything once and for all.
- **It never inserts anything into the page.** It only toggles a CSS class; the AD chip is drawn by CSS as a `::before` pseudo-element. Injecting real nodes into Pinterest's React-managed tiles risks crashing their UI.

Verified against Pinterest's live feed on 2026-09-17.

---

## For developers

There is no build step — the files in the repository root are what ships.

```bash
cd test && npm install && npm test
```

The suite loads `content.js` into a jsdom page and asserts against real DOM state (34 cases at the time of writing), covering false-positive resistance, nested pins, node recycling and the mutation observer. `test/` has its own `package.json` on purpose, to keep `node_modules` out of the extension root — Chrome packs everything in the loaded directory.

Deeper notes on the design and its tradeoffs live in [CLAUDE.md](CLAUDE.md).

Content-script logging appears in the **Pinterest tab's** DevTools console — there is no background service worker.
