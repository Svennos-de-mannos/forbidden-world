// Builds the NPCs & Characters page from data/npcs.json.
//
// Layout: one dropdown per campaign (from data/campaigns.json), each
// holding an NPCs dropdown and a Players dropdown. Anyone tied to more
// than one campaign appears under EACH of their campaigns and also in an
// extra "Cross-campaign" dropdown at the bottom (which also catches anyone
// whose campaign id isn't in campaigns.json).
// Order inside each list is the order in npcs.json.

const STATUS_LABELS = { alive: 'Alive', dead: 'Dead', unknown: 'Unknown' };

function makeEl(tag, className, text) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text !== undefined) el.textContent = text;
  return el;
}

function normalizeStatus(value) {
  const s = String(value || '').trim().toLowerCase();
  return STATUS_LABELS[s] ? s : 'unknown';
}

function campaignIdsOf(person) {
  return [].concat(person.campaign || []).filter(Boolean);
}

function buildPersonBar(person, ctx) {
  const status = normalizeStatus(person.aliveStatus);
  const accent = resolveColor(person.color, ctx.palette);
  const campaignTitles = campaignIdsOf(person).map(
    (id) => (ctx.campaignById[id] ? ctx.campaignById[id].title : id)
  );

  const bar = makeEl('button', `person-bar person-bar--${status}`);
  bar.type = 'button';
  // Alive keeps the card's own color; dead/unknown get gray from CSS.
  if (status === 'alive') bar.style.setProperty('--accent', accent);

  const main = makeEl('div', 'person-bar__main');
  const name = makeEl('p', 'person-bar__name');
  fillOrPlaceholder(name, person.name);

  const meta = makeEl('p', 'person-bar__meta');
  const role = makeEl('span', 'person-bar__role');
  fillOrPlaceholder(role, person.role);
  meta.appendChild(role);
  if (campaignTitles.length) {
    meta.appendChild(makeEl('span', 'person-bar__campaign', ' · ' + campaignTitles.join(' · ')));
  }

  main.appendChild(name);
  main.appendChild(meta);
  bar.appendChild(main);
  bar.appendChild(makeEl('span', 'person-bar__status', STATUS_LABELS[status]));

  bar.addEventListener('click', () =>
    fillNpcPopup(person, { accent, campaignTitles, statusLabel: STATUS_LABELS[status] })
  );
  return bar;
}

function buildSubgroup(label, people, ctx) {
  const details = makeEl('details', 'subgroup');
  const summary = makeEl('summary', 'subgroup__summary');
  summary.appendChild(makeEl('span', 'subgroup__title', label));
  summary.appendChild(makeEl('span', 'subgroup__count', String(people.length)));
  details.appendChild(summary);

  const body = makeEl('div', 'subgroup__body');
  if (people.length === 0) {
    body.appendChild(makeEl('p', 'group__empty', 'Nothing here yet'));
  } else {
    people.forEach((p) => body.appendChild(buildPersonBar(p, ctx)));
  }
  details.appendChild(body);
  return details;
}

function buildGroup(title, accent, people, ctx) {
  const details = makeEl('details', 'group');
  if (accent) details.style.setProperty('--accent', accent);

  const summary = makeEl('summary', 'group__summary');
  summary.appendChild(makeEl('span', 'group__title', title));
  summary.appendChild(makeEl('span', 'group__count', String(people.length)));
  details.appendChild(summary);

  const body = makeEl('div', 'group__body');
  const isPlayer = (p) => p.kind === 'player';
  body.appendChild(buildSubgroup('NPCs', people.filter((p) => !isPlayer(p)), ctx));
  body.appendChild(buildSubgroup('Players', people.filter(isPlayer), ctx));
  details.appendChild(body);
  return details;
}

async function renderPeoplePage() {
  const list = document.getElementById('peopleList');
  if (!list) return;

  const [campaigns, people, palette] = await Promise.all([
    loadCards('data/campaigns.json'),
    loadCards('data/npcs.json'),
    loadPalette(),
  ]);
  const campaignById = Object.fromEntries(campaigns.map((c) => [c.id, c]));
  const ctx = { campaignById, palette };

  const crossCampaign = [];
  const byCampaign = Object.fromEntries(campaigns.map((c) => [c.id, []]));

  people.forEach((person) => {
    const ids = campaignIdsOf(person);
    const known = ids.filter((id) => byCampaign[id]);

    // Listed under every campaign they belong to...
    known.forEach((id) => byCampaign[id].push(person));

    ids.filter((id) => !byCampaign[id]).forEach((id) => {
      console.warn(`"${person.name}" uses campaign "${id}", which isn't in campaigns.json.`);
    });

    // ...and also in the Cross-campaign list if they span several campaigns
    // (or don't match any known campaign, so nobody gets lost).
    if (ids.length > 1 || known.length === 0) crossCampaign.push(person);
  });

  campaigns.forEach((c) => {
    list.appendChild(buildGroup(c.title, c.colorMain, byCampaign[c.id], ctx));
  });
  if (crossCampaign.length) {
    list.appendChild(buildGroup('Cross-campaign', null, crossCampaign, ctx));
  }
}

document.addEventListener('DOMContentLoaded', renderPeoplePage);
