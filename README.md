# NoxKuu art gallery

A plain HTML, CSS and JavaScript site hosted on the existing Azure Static Web App. No framework, build step, API, API key or paid service is required.

## Update artwork

Edit assets/artwork.js. Entries are oldest first; append new entries at the end. The newest six appear on the home page.

- src: the original full-size Azure Blob URL. Keep filename capitalisation exactly as uploaded.
- thumbnail: the small generated WebP used by gallery cards and as the immediate preview in the dialog.
- display: the sharper generated WebP used by the dialog. The Open original link still points to src.
- title and alt: the visible name and a short accessible description.
- primary and secondary: lower-case category and series names, reused by the filters.
- description: saved character notes shown immediately when an image opens. No AI service is called. Please review these notes with the artist.

## Generate web images

The gallery uses WebP thumbnails stored in assets/thumbnails, at most 800px wide and 1000px tall. The dialog shows that thumbnail immediately, then swaps in a higher-quality WebP from assets/views, capped at a 2000px longest edge. Originals are untouched and available through Open original. After the current viewing image loads, only the next optimized view is prefetched at low priority; data-saver and slow 2G connections skip prefetching. Closing or changing artwork cancels obsolete viewer work. No separate Azure upload is needed: both sizes deploy with the static website.

After adding artwork entries, install Pillow if needed with python -m pip install Pillow, then run python scripts/generate_thumbnails.py. The script downloads public originals, preserves aspect ratio and transparency, creates both image sizes, and updates the catalogue automatically. Downloads are cached in the ignored .cache folder. Use --refresh to regenerate from changed originals. Review and commit the catalogue and thumbnails together; Python is only needed for authoring, not for hosting.

## Preview locally

Run python -m http.server 8080 in this folder, then open http://localhost:8080. ES modules need an HTTP server rather than opening index.html directly.

## Deploy and review

The existing GitHub Actions workflow publishes main to Azure. Pull requests create Azure preview environments; merging publishes the update. Review the pull request and preview before merging. The local checkout is also the GitHub Desktop repository.

staticwebapp.config.json adds response security headers. Scripts and styles are local; Google Fonts and the existing Azure image account are explicitly permitted. No outbound API calls are permitted. Update the image policy if the image host changes.

The former Gemini key has been removed from the current source, but may remain in Git history. A retired model does not retire its API key. If the key has not already been revoked, revoke it in Google AI Studio; do not paste a replacement into this repository.

## Viewer checks

With Node.js 22 or newer, run node --test tests/image-viewer.test.mjs to check preview swapping, late responses, close/failure handling and bounded prefetching.
