// Renders the "Campaigns" section on the home page from data/campaigns.json.
// This is the first real proof that the registry pattern works end to
// end: add a campaign to the JSON and it appears here with zero code
// changes.

async function renderHomeCampaigns() {
  const list = document.getElementById('campaignsList');
  if (!list) return;

  const campaigns = await loadCards('data/campaigns.json');

  list.innerHTML = campaigns.map((c) => `
    <a class="campaign-bar" href="campaigns.html" style="--accent: ${c.colorMain}">
      <div class="info">
        <p class="name">${c.title}</p>
        <p class="mystery${c.mainMystery ? '' : ' placeholder'}">${c.mainMystery || ''}</p>
      </div>
      <div class="arrow">&rsaquo;</div>
    </a>
  `).join('');
}

document.addEventListener('DOMContentLoaded', renderHomeCampaigns);
