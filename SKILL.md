---
name: html-to-pptx
description: Convert local HTML slide decks to shareable PPTX files by rendering each slide as a high-resolution image, validating broken images/media, optionally embedding or packaging video assets, and creating a release ZIP. Use when the user asks to turn an HTML/web PPT/deck into PPTX, export a huashu/guizang HTML deck, preserve visual fidelity, include videos, or package a PPTX for classmates/judges.
---

# HTML to PPTX

Use this skill when converting a local HTML slide deck into a PowerPoint-friendly deliverable. It is designed for high visual fidelity: render each HTML slide to a full-slide PNG, build a 16:9 PPTX from those images, then optionally bundle video files into a ZIP.

## Core Workflow

1. Inspect the deck:
   - Find the deck directory and entry file, usually `index.html`.
   - Identify slide order. Prefer parsing the `slides = [...]` array if present; otherwise use sorted `slides/*.html`.
   - Identify external assets such as `../figure`, `../assets`, videos, fonts, and CSS.

2. Render slides:
   - Use `scripts/render_html_deck.js`.
   - Set `--serve-root` high enough that relative paths like `../../figure/foo.png` resolve.
   - Use `--strict` by default so broken images stop the export instead of silently becoming broken icons.

3. Build PPTX:
   - Use `scripts/build_pptx.py`.
   - Prefer image-based slides for fidelity. This makes slides less editable but closest to the HTML.
   - If a video page exists, either embed it when reliable or include the video in the ZIP as a separate file.

4. Package release:
   - Use `scripts/pack_release.ps1`.
   - Include the final PPTX and any video files the presenter may need.
   - Avoid asking the user to gather files manually; create a ready-to-send ZIP.

## Recommended Commands

Render a deck:

```powershell
node "C:\Users\20245\.codex\skills\html-to-pptx\scripts\render_html_deck.js" `
  --deck-dir "deck" `
  --serve-root "." `
  --out "deck\exports\slide-images" `
  --strict
```

Build PPTX:

```powershell
py "C:\Users\20245\.codex\skills\html-to-pptx\scripts\build_pptx.py" `
  --manifest "deck\exports\slide-manifest.json" `
  --out "deck\exports\deck.pptx"
```

Package PPTX and video:

```powershell
powershell -ExecutionPolicy Bypass -File "C:\Users\20245\.codex\skills\html-to-pptx\scripts\pack_release.ps1" `
  -OutputZip "deck\exports\deck-release.zip" `
  -Files "deck\exports\deck.pptx","assets\demo.mp4"
```

## Reliability Rules

- If PowerPoint has the target `.pptx` open, saving may fail with `PermissionError`. Create a new output filename rather than overwriting the locked file.
- After rendering, inspect at least one key slide image with real figures before building the PPTX.
- If a slide shows broken image icons, fix the serve root or asset paths before building the PPTX.
- For Chinese filenames, keep paths quoted and use PowerShell `-LiteralPath` where possible.
- If video embedding is uncertain, include the `.mp4` beside the PPTX in the final ZIP.

## Output Expectations

The final response should give the exact clickable path to the PPTX or ZIP, mention slide count when verified, and state whether video is embedded or packaged separately.
