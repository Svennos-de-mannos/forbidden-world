// Builds the Search page: type to filter by TITLE across every card
// type at once, results grouped under per-type headings. Clicking a
// result swaps in that type's actual popup partial and fills it with
// its real fill function — so results behave exactly like they do on
// their own page.
//
// Reuses helpers already defined by the other page scripts (makeEl,
// STATUS_LABELS, statusLabelOf, campaignIdsOf, normalizeStatus, etc.) —
// this file only adds what's specific to searching, nothing more.

let loadedPopupType = null;

async function ensurePopupType(type) {
  if (loadedPopupType === type) return;
  const slot = document.getElementById('popupSlot');
  const res = await fetch(`partials/popup-${type}.html`);
  slot.innerHTML = await res.text();
  loadedPopupType = type;
  initPopup(); // re-bind close/backdrop/escape handlers to the fresh nodes
}

// One entry per searchable type. `dataFile`s that repeat (npcs.json for
// both npc/player, quests.json for both quest/mystery) are only fetched
// once — see dataFor() below.
const SEARCH_TYPES = [
  {
    key: 'campaign', label: 'Campaigns', dataFile: 'data/campaigns.json',
    getTitle: (c) => c.title,
    getAccent: (c) => c.colorMain,
    open: (c) => fillCampaignPopup(c),
  },
  {
    key: 'quest', label: 'Quests', dataFile: 'data/quests.json',
    filter: (i) => i.type === 'quest',
    getTitle: (i) => i.title,
    getAccent: (i, ctx) => resolveColor(i.color, ctx.palette),
    open: (i, ctx, accent) => fillQuestPopup(i, {
      accent,
      campaignTitles: (i.campaign || []).map((id) => (ctx.campaignById[id] ? ctx.campaignById[id].title : id)),
      statusLabel: statusLabelOf(i.status),
    }),
  },
  {
    key: 'mystery', label: 'Mysteries', dataFile: 'data/quests.json',
    filter: (i) => i.type === 'mystery',
    getTitle: (i) => i.title,
    getAccent: (i, ctx) => resolveColor(i.color, ctx.palette),
    open: (i, ctx, accent) => fillQuestPopup(i, {
      accent,
      campaignTitles: (i.campaign || []).map((id) => (ctx.campaignById[id] ? ctx.campaignById[id].title : id)),
      statusLabel: statusLabelOf(i.status),
    }),
  },
  {
    key: 'session', label: 'Session Recaps', dataFile: 'data/sessions.json',
    getTitle: (s) => s.title,
    getAccent: (s, ctx) => resolveColor(s.color, ctx.palette) || (ctx.campaignById[s.campaign] && ctx.campaignById[s.campaign].colorMain),
    open: (s, ctx, accent) => fillSessionPopup(s, {
      accent,
      metaLabel: s.oneShot ? 'One-shot' : `Session ${s.sessionNumber} · ${ctx.campaignById[s.campaign] ? ctx.campaignById[s.campaign].title : ''}`,
    }),
  },
  {
    key: 'npc', label: 'NPCs', dataFile: 'data/npcs.json',
    filter: (p) => p.kind === 'npc',
    getTitle: (p) => p.name,
    getAccent: (p, ctx) => resolveColor(p.color, ctx.palette),
    open: (p, ctx, accent) => fillNpcPopup(p, {
      accent,
      campaignTitles: campaignIdsOf(p).map((id) => (ctx.campaignById[id] ? ctx.campaignById[id].title : id)),
      statusLabel: STATUS_LABELS[normalizeStatus(p.aliveStatus)],
    }),
  },
  {
    key: 'player', label: 'Players', dataFile: 'data/npcs.json',
    filter: (p) => p.kind === 'player',
    getTitle: (p) => p.name,
    getAccent: (p, ctx) => resolveColor(p.color, ctx.palette),
    open: (p, ctx, accent) => fillNpcPopup(p, {
      accent,
      campaignTitles: campaignIdsOf(p).map((id) => (ctx.campaignById[id] ? ctx.campaignById[id].title : id)),
      statusLabel: STATUS_LABELS[normalizeStatus(p.aliveStatus)],
    }),
  },
  {
    key: 'location', label: 'Locations', dataFile: 'data/locations.json',
    getTitle: (l) => l.title,
    getAccent: (l, ctx) => resolveColor(l.color, ctx.palette),
    open: (l, ctx, accent) => fillLocationPopup(l, { accent, parentTitle: ctx.locationTitleById[l.parent] }),
  },
  {
    key: 'faction', label: 'Factions', dataFile: 'data/factions.json',
    getTitle: (f) => f.title,
    getAccent: (f, ctx) => resolveColor(f.color, ctx.palette),
    open: (f, ctx, accent) => fillFactionPopup(f, { accent }),
  },
];

async function initSearch() {
  const input = document.getElementById('searchInput');
  const results = document.getElementById('searchResults');
  if (!input || !results) return;

  const [campaigns, locations, palette] = await Promise.all([
    loadCards('data/campaigns.json'),
    loadCards('data/locations.json'),
    loadPalette(),
  ]);
  const ctx = {
    campaignById: Object.fromEntries(campaigns.map((c) => [c.id, c])),
    locationTitleById: Object.fromEntries(locations.map((l) => [l.id, l.title])),
    palette,
  };

  // Fetch each unique data file once, even though several types share one.
  const fileCache = {};
  const dataFor = (file) => (fileCache[file] = fileCache[file] || loadCards(file));
  for (const t of SEARCH_TYPES) {
    const items = await dataFor(t.dataFile);
    t.pool = t.filter ? items.filter(t.filter) : items;
  }

  function render(query) {
    results.innerHTML = '';
    const q = query.trim().toLowerCase();

    if (!q) {
      results.appendChild(makeEl('p', 'group__empty', 'Start typing to search titles across the whole site.'));
      return;
    }

    let anyMatches = false;
    SEARCH_TYPES.forEach((t) => {
      const matches = t.pool.filter((item) => String(t.getTitle(item) || '').toLowerCase().includes(q));
      if (!matches.length) return;
      anyMatches = true;

      const section = makeEl('section', 'search-group');
      section.appendChild(makeEl('h2', 'section-title', t.label));
      matches.forEach((item) => {
        const accent = t.getAccent(item, ctx);
        const btn = makeEl('button', 'search-result');
        btn.type = 'button';
        btn.style.setProperty('--accent', accent || '');
        fillOrPlaceholder(btn, t.getTitle(item));
        btn.addEventListener('click', async () => {
          await ensurePopupType(t.key);
          t.open(item, ctx, accent);
        });
        section.appendChild(btn);
      });
      results.appendChild(section);
    });

    if (!anyMatches) results.appendChild(makeEl('p', 'group__empty', 'No matches.'));
  }

  input.addEventListener('input', () => render(input.value));
  render('');
}

document.addEventListener('DOMContentLoaded', initSearch);
