// Fills the shared popup shell with one location, then opens it.
// Locations have no image field (per the spec) — just color, title,
// parent, and text.

function fillLocationPopup(loc, view) {
  const popup = document.getElementById('popup');
  if (popup) popup.style.setProperty('--accent', view.accent);

  const set = (id, value) => {
    const el = document.getElementById(id);
    if (el) fillOrPlaceholder(el, value);
  };

  set('popupTitle', loc.title);
  set('popupText', loc.text);

  const parentEl = document.getElementById('popupParent');
  if (parentEl) {
    if (loc.parent === 'self') {
      parentEl.textContent = 'Root location';
      parentEl.classList.remove('placeholder');
    } else {
      fillOrPlaceholder(parentEl, view.parentTitle ? `Part of ${view.parentTitle}` : '');
    }
  }

  openPopup();
}
