// Generic popup show/hide engine. Type-specific files (e.g.
// popup-campaign.js) provide their own "fill" function that writes a
// card's data into the popup's fields, then call openPopup().
// Only one popup exists per page — it's blanked and hidden again on close.

function openPopup() {
  const overlay = document.getElementById('popupOverlay');
  if (!overlay) return;
  overlay.hidden = false;
}

function closePopup() {
  const overlay = document.getElementById('popupOverlay');
  if (!overlay) return;
  overlay.hidden = true;

  // Blank every field so nothing lingers from the last card that was open.
  const title = document.getElementById('popupTitle');
  const text = document.getElementById('popupText');
  const image = document.getElementById('popupImage');
  if (title) title.textContent = '';
  if (text) { text.textContent = ''; text.classList.remove('placeholder'); }
  if (image) {
    image.removeAttribute('src');
    image.classList.add('placeholder');
  }
  const popup = document.getElementById('popup');
  if (popup) popup.style.removeProperty('--accent');
}

function initPopup() {
  const overlay = document.getElementById('popupOverlay');
  const closeBtn = document.getElementById('popupClose');
  if (!overlay || !closeBtn) return;

  closeBtn.addEventListener('click', closePopup);
  // Click on the dark backdrop (outside the card itself) also closes it.
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closePopup();
  });
  // Escape key closes it too.
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !overlay.hidden) closePopup();
  });
}
