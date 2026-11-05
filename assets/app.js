import { artwork } from './artwork.js';

const allArtwork = [...artwork].reverse();
const $ = id => document.getElementById(id);
const dialog = $('art-dialog');
let modalArtwork = [];
let modalIndex = 0;
let opener = null;
let galleryBuilt = false;
const label = value => value === 'dc' ? 'DC' : value === 'tv & film' ? 'TV & Film' : value === 'lol' ? 'League of Legends' : value.replace(/\b\w/g, letter => letter.toUpperCase());

function setTheme(theme) {
  document.documentElement.dataset.theme = theme;
  $('theme-toggle').textContent = theme === 'dark' ? 'Light' : 'Dark';
  $('theme-toggle').setAttribute('aria-label', 'Switch to ' + (theme === 'dark' ? 'light' : 'dark') + ' theme');
}
let savedTheme;
try { savedTheme = localStorage.getItem('theme'); } catch { /* Browsing without storage is supported. */ }
setTheme(['light', 'dark'].includes(savedTheme) ? savedTheme : matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
$('theme-toggle').addEventListener('click', () => {
  const theme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  setTheme(theme);
  try { localStorage.setItem('theme', theme); } catch { /* Theme still works for this visit. */ }
});

function fillSelect(select, values, allLabel) {
  select.replaceChildren(new Option(allLabel, 'all'));
  values.sort((a, b) => a.localeCompare(b)).forEach(value => select.add(new Option(label(value), value)));
}
function filteredArtwork() {
  return allArtwork.filter(art => ($('category').value === 'all' || art.primary.includes($('category').value)) && ($('series').value === 'all' || art.secondary.includes($('series').value)));
}
function createCard(art, group, index) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'art-card';
  button.setAttribute('aria-label', 'View ' + art.title);
  button.setAttribute('aria-haspopup', 'dialog');
  const frame = document.createElement('span');
  frame.className = 'thumbnail';
  const image = document.createElement('img');
  image.alt = art.alt;
  image.loading = index < 3 && location.hash !== '#gallery' ? 'eager' : 'lazy';
  image.decoding = 'async';
  // Set thumbnail to a smaller Azure image when one is available. Original remains untouched.
  image.src = art.thumbnail || art.src;
  image.addEventListener('error', () => {
    if (art.thumbnail && image.getAttribute('src') === art.thumbnail) image.src = art.src;
    else image.alt = art.alt + ' (image currently unavailable)';
  });
  frame.append(image);
  const caption = document.createElement('span');
  caption.className = 'card-caption';
  caption.textContent = art.title;
  button.append(frame, caption);
  button.addEventListener('click', () => {
    opener = button;
    modalArtwork = group;
    modalIndex = group.indexOf(art);
    updateModal();
    dialog.showModal();
    document.body.classList.add('modal-open');
    $('close-dialog').focus();
  });
  return button;
}
function renderGallery() {
  const visible = filteredArtwork();
  $('full-gallery').replaceChildren(...visible.map((art, index) => createCard(art, visible, index)));
  $('gallery-count').textContent = visible.length + (visible.length === 1 ? ' artwork' : ' artworks');
}
$('category').addEventListener('change', () => {
  const categoryArtwork = allArtwork.filter(art => $('category').value === 'all' || art.primary.includes($('category').value));
  const series = [...new Set(categoryArtwork.flatMap(art => art.secondary))];
  fillSelect($('series'), series, 'All series');
  $('series-filter').hidden = $('category').value === 'all' || series.length === 0;
  renderGallery();
});
$('series').addEventListener('change', renderGallery);

function updateModal() {
  const art = modalArtwork[modalIndex];
  $('art-image').hidden = true;
  $('image-loading').hidden = false;
  $('image-error').hidden = true;
  $('art-image').alt = art.alt;
  $('art-image').src = art.src;
  if ($('art-image').complete && $('art-image').naturalWidth > 0) {
    $('art-image').hidden = false;
    $('image-loading').hidden = true;
  }
  $('art-title').textContent = art.title;
  $('art-tags').textContent = [...new Set([...art.primary, ...art.secondary])].map(label).join(' · ');
  $('art-description').textContent = art.description || 'An original creation by NoxKuu.';
  $('art-position').textContent = (modalIndex + 1) + ' of ' + modalArtwork.length;
  $('previous-art').disabled = $('next-art').disabled = modalArtwork.length < 2;
}
function changeArtwork(direction) {
  if (modalArtwork.length < 2) return;
  modalIndex = (modalIndex + direction + modalArtwork.length) % modalArtwork.length;
  updateModal();
}
$('art-image').addEventListener('error', () => { $('art-image').hidden = true; $('image-loading').hidden = true; $('image-error').hidden = false; });
$('art-image').addEventListener('load', () => { $('art-image').hidden = false; $('image-loading').hidden = true; $('image-error').hidden = true; });
$('close-dialog').addEventListener('click', () => dialog.close());
dialog.addEventListener('close', () => { document.body.classList.remove('modal-open'); if (opener?.isConnected) opener.focus(); });
dialog.addEventListener('click', event => {
  const bounds = dialog.getBoundingClientRect();
  if (event.target === dialog && (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom)) dialog.close();
});
$('previous-art').addEventListener('click', () => changeArtwork(-1));
$('next-art').addEventListener('click', () => changeArtwork(1));
dialog.addEventListener('keydown', event => {
  if (event.key === 'Tab') {
    const buttons = [...dialog.querySelectorAll('button:not(:disabled)')];
    const first = buttons[0];
    const last = buttons[buttons.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }
  if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); changeArtwork(event.key === 'ArrowLeft' ? -1 : 1); }
});

function route(focusHeading = false) {
  const gallery = location.hash === '#gallery';
  if (dialog.open) dialog.close();
  $('home-view').hidden = gallery;
  $('gallery-view').hidden = !gallery;
  if (gallery && !galleryBuilt) { renderGallery(); galleryBuilt = true; }
  document.title = gallery ? 'Gallery | NoxKuu' : 'NoxKuu | Digital Art';
  if (focusHeading) { $('main').focus({ preventScroll: true }); window.scrollTo(0, 0); }
}
const recent = allArtwork.slice(0, 6);
$('recent-gallery').replaceChildren(...recent.map((art, index) => createCard(art, recent, index)));
fillSelect($('category'), [...new Set(allArtwork.flatMap(art => art.primary))], 'All artwork');
$('year').textContent = new Date().getFullYear();
addEventListener('hashchange', () => route(true));
route();

document.querySelector('.skip-link').addEventListener('click', event => {
  event.preventDefault();
  $('main').focus({ preventScroll: true });
  window.scrollTo(0, 0);
});
