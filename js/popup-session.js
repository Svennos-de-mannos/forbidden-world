// Fills the shared popup shell with one session recap, then opens it.

function fillSessionPopup(session, view) {
  const popup = document.getElementById('popup');
  if (popup) popup.style.setProperty('--accent', view.accent);

  const set = (id, value) => {
    const el = document.getElementById(id);
    if (el) fillOrPlaceholder(el, value);
  };

  set('popupTitle', session.title);
  set('popupMeta', view.metaLabel);
  set('popupPlayers', session.players && session.players.length ? `Players: ${session.players.join(', ')}` : '');
  set('popupText', session.text);

  const image = document.getElementById('popupImage');
  if (image) {
    if (session.coverImage) {
      image.style.backgroundImage = `url('${session.coverImage}')`;
      image.classList.remove('placeholder');
    } else {
      image.style.backgroundImage = '';
      image.classList.add('placeholder');
    }
  }

  openPopup();
}
