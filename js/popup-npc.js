// Fills the shared popup shell with one NPC/player, then opens it.
// `view` carries the values the page already worked out:
//   { accent, campaignTitles, statusLabel }

function fillNpcPopup(person, view) {
  const popup = document.getElementById('popup');
  const image = document.getElementById('popupImage');

  const set = (id, value) => {
    const el = document.getElementById(id);
    if (el) fillOrPlaceholder(el, value);
  };

  if (popup) popup.style.setProperty('--accent', view.accent);

  set('popupTitle', person.name);
  set('popupRole', person.role);
  set('popupRace', person.race);
  set('popupClass', person.class);
  set('popupAge', person.age);
  set('popupStatus', view.statusLabel);
  set('popupResidence', person.residence);
  set('popupCampaign', view.campaignTitles.join(' · '));
  set('popupText', person.text);

  if (image) {
    if (person.image) {
      image.style.backgroundImage = `url('${person.image}')`;
      image.classList.remove('placeholder');
    } else {
      image.style.backgroundImage = '';
      image.classList.add('placeholder');
    }
  }

  openPopup();
}
