// Builds the Locations page from data/locations.json.
//
// Layout: a heading per campaign (locations aren't cross-campaign), then
// each root location (parent === "self") as a collapsible node with its
// children nested recursively underneath — however deep that goes.
// Clicking a location's name opens its popup; clicking elsewhere on its
// row expands/collapses its children, same row, two separate actions.

function makeEl(tag, className, text) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text !== undefined) el.textContent = text;
  return el;
}

function buildLocationNode(loc, childrenByParent, ctx, depth) {
  const accent = resolveColor(loc.color, ctx.palette);
  const children = childrenByParent[loc.id] || [];

  const nameBtn = makeEl('button', 'location-name', loc.title || '');
  nameBtn.type = 'button';
  if (!loc.title) nameBtn.classList.add('placeholder');
  nameBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    fillLocationPopup(loc, { accent, parentTitle: ctx.titleById[loc.parent] });
  });

  if (children.length === 0) {
    // Leaf node — a plain row, nothing to expand.
    const row = makeEl('div', 'location-row location-row--leaf');
    row.style.setProperty('--accent', accent);
    row.style.setProperty('--depth', depth);
    row.appendChild(nameBtn);
    return row;
  }

  // Has children — an expandable node. Clicking the name (handled above,
  // with stopPropagation + preventDefault) opens the popup without
  // toggling the disclosure; clicking anywhere else in the row toggles it.
  const details = makeEl('details', 'location-row location-row--branch');
  details.style.setProperty('--accent', accent);
  details.style.setProperty('--depth', depth);

  const summary = makeEl('summary', 'location-row__summary');
  summary.appendChild(nameBtn);
  details.appendChild(summary);

  const childWrap = makeEl('div', 'location-row__children');
  children.forEach((child) => {
    childWrap.appendChild(buildLocationNode(child, childrenByParent, ctx, depth + 1));
  });
  details.appendChild(childWrap);

  return details;
}

async function renderLocationsPage() {
  const list = document.getElementById('locationsList');
  if (!list) return;

  const [campaigns, locations, palette] = await Promise.all([
    loadCards('data/campaigns.json'),
    loadCards('data/locations.json'),
    loadPalette(),
  ]);

  const titleById = Object.fromEntries(locations.map((l) => [l.id, l.title]));
  const ctx = { palette, titleById };

  campaigns.forEach((campaign) => {
    const forCampaign = locations.filter((l) => l.campaign === campaign.id);

    const section = makeEl('section', 'location-campaign');
    const heading = makeEl('h2', 'section-title', campaign.title);
    heading.style.setProperty('--accent', campaign.colorMain);
    section.appendChild(heading);

    if (forCampaign.length === 0) {
      section.appendChild(makeEl('p', 'group__empty', 'No locations yet'));
      list.appendChild(section);
      return;
    }

    const childrenByParent = {};
    forCampaign.forEach((l) => {
      if (l.parent !== 'self') {
        (childrenByParent[l.parent] = childrenByParent[l.parent] || []).push(l);
      }
    });

    const roots = forCampaign.filter((l) => l.parent === 'self');
    roots.forEach((root) => {
      section.appendChild(buildLocationNode(root, childrenByParent, ctx, 0));
    });

    list.appendChild(section);
  });
}

document.addEventListener('DOMContentLoaded', renderLocationsPage);
