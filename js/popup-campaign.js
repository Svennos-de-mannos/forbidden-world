// Fills the shared popup shell with one campaign's data, then opens it.
// Pairs with the generic engine in popup.js.

function fillCampaignPopup(card) {
  const popup = document.getElementById('popup');
  const title = document.getElementById('popupTitle');
  const mystery = document.getElementById('popupMystery');
  const text = document.getElementById('popupText');
  const image = document.getElementById('popupImage');

  if (popup) popup.style.setProperty('--accent', card.colorMain || '');
  if (title) title.textContent = card.title || '';
  if (mystery) fillOrPlaceholder(mystery, card.mainMystery);
  if (text) fillOrPlaceholder(text, card.text);

  if (image) {
    if (card.image) {
      image.style.backgroundImage = `url('${card.image}')`;
      image.classList.remove('placeholder');
    } else {
      image.style.backgroundImage = '';
      image.classList.add('placeholder');
    }
  }

  openPopup();
}
