// Fills the shared popup shell with one faction, then opens it.
// Image is optional per the spec — falls back to the "???" placeholder.

function fillFactionPopup(faction, view) {
  const popup = document.getElementById('popup');
  if (popup) popup.style.setProperty('--accent', view.accent);

  const set = (id, value) => {
    const el = document.getElementById(id);
    if (el) fillOrPlaceholder(el, value);
  };

  set('popupTitle', faction.title);
  set('popupText', faction.text);

  const image = document.getElementById('popupImage');
  if (image) {
    if (faction.image) {
      image.style.backgroundImage = `url('${faction.image}')`;
      image.classList.remove('placeholder');
    } else {
      image.style.backgroundImage = '';
      image.classList.add('placeholder');
    }
  }

  openPopup();
}
