// Fills the shared popup shell with one quest/mystery, then opens it.

function fillQuestPopup(item, view) {
  const popup = document.getElementById('popup');
  if (popup) popup.style.setProperty('--accent', view.accent);

  const set = (id, value) => {
    const el = document.getElementById(id);
    if (el) fillOrPlaceholder(el, value);
  };

  set('popupTitle', item.title);
  set('popupDescription', item.description);
  set('popupCampaign', view.campaignTitles.join(' · '));
  set('popupStatus', view.statusLabel);
  set('popupText', item.text);

  openPopup();
}
