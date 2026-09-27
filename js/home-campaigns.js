// Renders the "Campaigns" section on the home page from data/campaigns.json,
// and opens the shared popup (filled via popup-campaign.js) when a bar
// is clicked — instead of navigating to campaigns.html.

async function renderHomeCampaigns() {
  const list = document.getElementById('campaignsList');
  if (!list) return;

  const campaigns = await loadCards('data/campaigns.json');

  campaigns.forEach((c) => {
    const bar = document.createElement('button');
    bar.type = 'button';
    bar.className = 'campaign-bar';
    bar.style.setProperty('--accent', c.colorMain);
    bar.innerHTML = `
      <div class="info">
        <p class="name">${c.title}</p>
        <p class="mystery${c.mainMystery ? '' : ' placeholder'}">${c.mainMystery || ''}</p>
      </div>
      <div class="arrow">&rsaquo;</div>
    `;
    bar.addEventListener('click', () => fillCampaignPopup(c));
    list.appendChild(bar);
  });
}

document.addEventListener('DOMContentLoaded', renderHomeCampaigns);
