// Builds the Factions page from data/factions.json.
//
// Layout: a heading per campaign (flat button list underneath, title
// only — no dropdowns, per the spec), plus a Cross-campaign section at
// the bottom for anything listed under more than one campaign (or
// pointing at a campaign id that isn't in campaigns.json).

function makeEl(tag, className, text) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text !== undefined) el.textContent = text;
  return el;
}

function buildFactionButton(faction, ctx) {
  const accent = resolveColor(faction.color, ctx.palette);
  const btn = makeEl('button', 'faction-btn');
  btn.type = 'button';
  btn.style.setProperty('--accent', accent);
  fillOrPlaceholder(btn, faction.title);
  btn.addEventListener('click', () => fillFactionPopup(faction, { accent }));
  return btn;
}

function buildSection(title, factions, ctx) {
  const section = makeEl('section', 'faction-group');
  section.appendChild(makeEl('h2', 'section-title', title));
  if (factions.length === 0) {
    section.appendChild(makeEl('p', 'group__empty', 'Nothing here yet'));
  } else {
    factions.forEach((f) => section.appendChild(buildFactionButton(f, ctx)));
  }
  return section;
}

async function renderFactionsPage() {
  const list = document.getElementById('factionsList');
  if (!list) return;

  const [campaigns, factions, palette] = await Promise.all([
    loadCards('data/campaigns.json'),
    loadCards('data/factions.json'),
    loadPalette(),
  ]);
  const campaignById = Object.fromEntries(campaigns.map((c) => [c.id, c]));
  const ctx = { campaignById, palette };

  const crossCampaign = [];
  const byCampaign = Object.fromEntries(campaigns.map((c) => [c.id, []]));

  factions.forEach((faction) => {
    const ids = [].concat(faction.campaign || []).filter(Boolean);
    const known = ids.filter((id) => byCampaign[id]);
    known.forEach((id) => byCampaign[id].push(faction));
    if (ids.length > 1 || known.length === 0) crossCampaign.push(faction);
  });

  campaigns.forEach((c) => list.appendChild(buildSection(c.title, byCampaign[c.id], ctx)));
  if (crossCampaign.length) list.appendChild(buildSection('Cross-campaign', crossCampaign, ctx));
}

document.addEventListener('DOMContentLoaded', renderFactionsPage);
