// Builds the Active Quests & Mysteries page from data/quests.json.
//
// Layout: Quests first (active/ongoing, colored), then a separate gray
// list of inactive quests below them; then the same pattern again for
// Mysteries. "Active" here means status === "ongoing" — anything else
// (failed/solved/completed) is inactive.

const QUEST_STATUS_LABELS = { ongoing: 'Ongoing', failed: 'Failed', solved: 'Solved', completed: 'Completed' };

function makeEl(tag, className, text) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text !== undefined) el.textContent = text;
  return el;
}

function statusLabelOf(status) {
  const key = String(status || '').trim().toLowerCase();
  return QUEST_STATUS_LABELS[key] || 'Unknown';
}

function isActive(item) {
  return String(item.status || '').trim().toLowerCase() === 'ongoing';
}

function buildQuestBar(item, ctx) {
  const active = isActive(item);
  const accent = resolveColor(item.color, ctx.palette);
  const campaignTitles = (item.campaign || []).map((id) => (ctx.campaignById[id] ? ctx.campaignById[id].title : id));
  const statusLabel = statusLabelOf(item.status);

  const bar = makeEl('button', `status-bar${active ? '' : ' status-bar--inactive'}`);
  bar.type = 'button';
  if (active) bar.style.setProperty('--accent', accent);

  const name = makeEl('span', 'status-bar__name');
  fillOrPlaceholder(name, item.title);
  bar.appendChild(name);

  const meta = makeEl('span', 'status-bar__meta', `${campaignTitles.join(' · ')} · ${statusLabel}`);
  bar.appendChild(meta);

  bar.addEventListener('click', () => fillQuestPopup(item, { accent, campaignTitles, statusLabel }));
  return bar;
}

function buildTypeSection(title, items, ctx) {
  const section = makeEl('section', 'quest-type');
  section.appendChild(makeEl('h2', 'section-title', title));

  const active = items.filter(isActive);
  const inactive = items.filter((i) => !isActive(i));

  if (active.length === 0 && inactive.length === 0) {
    section.appendChild(makeEl('p', 'group__empty', 'Nothing here yet'));
    return section;
  }

  active.forEach((item) => section.appendChild(buildQuestBar(item, ctx)));
  if (inactive.length) {
    const divider = makeEl('div', 'quest-type__divider');
    section.appendChild(divider);
    inactive.forEach((item) => section.appendChild(buildQuestBar(item, ctx)));
  }
  return section;
}

async function renderQuestsPage() {
  const list = document.getElementById('questsList');
  if (!list) return;

  const [campaigns, items, palette] = await Promise.all([
    loadCards('data/campaigns.json'),
    loadCards('data/quests.json'),
    loadPalette(),
  ]);
  const campaignById = Object.fromEntries(campaigns.map((c) => [c.id, c]));
  const ctx = { campaignById, palette };

  const quests = items.filter((i) => i.type === 'quest');
  const mysteries = items.filter((i) => i.type === 'mystery');

  list.appendChild(buildTypeSection('Quests', quests, ctx));
  list.appendChild(buildTypeSection('Mysteries', mysteries, ctx));
}

document.addEventListener('DOMContentLoaded', renderQuestsPage);
