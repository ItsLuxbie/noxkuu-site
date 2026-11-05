# NoxKuu art gallery

A plain HTML, CSS and JavaScript site hosted on the existing Azure Static Web App. No framework, build step, API, API key or paid service is required.

## Update artwork

Edit assets/artwork.js. Entries are oldest first; append new entries at the end. The newest six appear on the home page.

- src: the original full-size Azure Blob URL. Keep filename capitalisation exactly as uploaded.
- thumbnail: the generated local WebP copy used by gallery cards. The dialog always uses src. If the thumbnail fails, the card falls back to src.
- title and alt: the visible name and a short accessible description.
- primary and secondary: lower-case category and series names, reused by the filters.
- description: saved character notes shown immediately when an image opens. No AI service is called. Please review these notes with the artist.

## Generate thumbnails

The gallery uses WebP thumbnails stored in assets/thumbnails, at most 800px wide and 1000px tall. Full-size Azure Blob originals are left untouched and load only when opened (or if a thumbnail fails). No separate Azure upload is needed: thumbnails deploy with the static website.

After adding artwork entries, install Pillow if needed with python -m pip install Pillow, then run python scripts/generate_thumbnails.py. The script downloads public originals, preserves aspect ratio and transparency, creates thumbnails, and updates the catalogue automatically. Downloads are cached in the ignored .cache folder. Use --refresh to regenerate from changed originals. Review and commit the catalogue and thumbnails together; Python is only needed for authoring, not for hosting.

## Preview locally

Run python -m http.server 8080 in this folder, then open http://localhost:8080. ES modules need an HTTP server rather than opening index.html directly.

## Deploy and review

The existing GitHub Actions workflow publishes main to Azure. Pull requests create Azure preview environments; merging publishes the update. Review the pull request and preview before merging. The local checkout is also the GitHub Desktop repository.

staticwebapp.config.json adds response security headers. Scripts and styles are local; Google Fonts and the existing Azure image account are explicitly permitted. No outbound API calls are permitted. Update the image policy if the image host changes.

The former Gemini key has been removed from the current source, but may remain in Git history. A retired model does not retire its API key. If the key has not already been revoked, revoke it in Google AI Studio; do not paste a replacement into this repository.
