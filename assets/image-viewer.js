// Show a small preview immediately, then replace it with the decoded viewing image.
export function createImageViewer({ image, loading, error, originalLink, getNextArtwork, isOpen }) {
  let request = 0;
  let loader = null;
  let nextImage = null;
  let nextTimer;

  function stopImage(pending) {
    if (!pending) return;
    pending.onload = null;
    pending.onerror = null;
    pending.removeAttribute('src');
  }

  function prefetchNext(version) {
    clearTimeout(nextTimer);
    const connection = globalThis.navigator?.connection;
    if (connection?.saveData || ['slow-2g', '2g'].includes(connection?.effectiveType)) return;
    nextTimer = setTimeout(() => {
      if (version !== request || !isOpen()) return;
      const next = getNextArtwork();
      // Never prefetch a large original when an optimized viewing image is missing.
      if (!next?.display) return;
      stopImage(nextImage);
      nextImage = new Image();
      nextImage.decoding = 'async';
      nextImage.fetchPriority = 'low';
      nextImage.src = next.display;
    }, 200);
  }

  function load(artwork) {
    const version = ++request;
    clearTimeout(nextTimer);
    stopImage(loader);
    const source = artwork.display || artwork.src;
    // Keep a matching prefetch alive so the browser can reuse its request.
    if (nextImage && nextImage.getAttribute('src') !== source) {
      stopImage(nextImage);
      nextImage = null;
    }
    originalLink.href = artwork.src;
    image.alt = artwork.alt;
    image.hidden = true;
    error.hidden = true;
    loading.textContent = artwork.thumbnail ? 'Loading sharper image…' : 'Loading artwork…';
    loading.hidden = false;
    image.onload = () => {
      if (version === request && isOpen()) image.hidden = false;
    };
    image.onerror = () => {
      if (version !== request || !isOpen()) return;
      image.hidden = true;
      if (loading.hidden) {
        error.textContent = 'This image could not load. You can still open the original.';
        error.hidden = false;
      }
    };
    image.src = artwork.thumbnail || source;
    if (image.complete && image.naturalWidth > 0) image.hidden = false;

    const pending = new Image();
    loader = pending;
    pending.decoding = 'async';
    pending.onload = async () => {
      try { await pending.decode(); } catch { /* A loaded image can still be displayed without decode(). */ }
      if (version !== request || !isOpen()) return;
      image.src = source;
      image.hidden = false;
      loading.hidden = true;
      error.hidden = true;
      loader = null;
      prefetchNext(version);
    };
    pending.onerror = () => {
      if (version !== request || !isOpen()) return;
      loading.hidden = true;
      error.textContent = 'The sharper image could not load. You can still open the original.';
      error.hidden = false;
      loader = null;
    };
    pending.src = source;
  }

  function close() {
    request++;
    clearTimeout(nextTimer);
    stopImage(loader);
    stopImage(nextImage);
    loader = nextImage = null;
  }

  return { load, close };
}
