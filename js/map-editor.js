// Map editor (map-editor.html). Nothing here is saved for you: you edit the
// map in the browser, and every change produces JSON that you copy into the
// matching file in your repo (data/map.json, data/regions.json and
// data/locations.json).

const ED_GRAY = '#8a8578';

// ---- small helpers ------------------------------------------------------------------------------
// h('div', { class: 'x', onclick: fn }, child, child) -> element. Values go in
// as text, never as HTML, so nothing you type can break the page.
function h(tag, props, ...kids) {
  const el = document.createElement(tag);
  let value;
  Object.keys(props || {}).forEach((k) => {
    const v = props[k];
    if (v === undefined || v === null || v === false) return;
    if (k === 'class') el.className = v;
    else if (k === 'text') el.textContent = v;
    else if (k === 'value') value = v;
    else if (k.slice(0, 2) === 'on') el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? '' : v);
  });
  kids.flat().forEach((kid) => {
    if (kid === null || kid === undefined || kid === false) return;
    el.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
  });
  if (value !== undefined) el.value = value; // after the children, so <select> works
  return el;
}

function slugify(text) {
  return String(text).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function uniqueId(base, taken) {
  const root = base || 'item';
  let id = root;
  let n = 2;
  while (taken.has(id)) id = `${root}-${n++}`;
  return id;
}

// mix a #rrggbb colour towards white (amount 0..1)
function lighten(hex, amount) {
  const m = /^#([0-9a-f]{6})$/i.exec(hex || '');
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const mix = (c) => Math.round(c + (255 - c) * amount);
  return `#${[mix(n >> 16), mix((n >> 8) & 255), mix(n & 255)].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

// ---- JSON formatting (readable, one hex row per line) ----------------------------------------------
function fmtPlacement(p) {
  return `{ "location": ${JSON.stringify(p.location)}, "q": ${p.q}, "r": ${p.r} }`;
}

function fmtMapFile(placements) {
  if (!placements.length) return '[]';
  return `[\n${placements.map((p) => `  ${fmtPlacement(p)}`).join(',\n')}\n]`;
}

function fmtHexes(hexes, indent) {
  if (!hexes.length) return '[]';
  const sorted = hexes.slice().sort((a, b) => a[1] - b[1] || a[0] - b[0]);
  const lines = [];
  for (let i = 0; i < sorted.length; i += 8) {
    lines.push(`${indent}  ${sorted.slice(i, i + 8).map(([q, r]) => `[${q}, ${r}]`).join(', ')}`);
  }
  return `[\n${lines.join(',\n')}\n${indent}]`;
}

function fmtRegion(region, indent = '') {
  const i2 = `${indent}  `;
  return [
    `${indent}{`,
    `${i2}"id": ${JSON.stringify(region.id)},`,
    `${i2}"title": ${JSON.stringify(region.title)},`,
    `${i2}"colorMain": ${JSON.stringify(region.colorMain)},`,
    `${i2}"colorSecondary": ${JSON.stringify(region.colorSecondary)},`,
    `${i2}"text": ${JSON.stringify(region.text || '')},`,
    `${i2}"hexes": ${fmtHexes(region.hexes, i2)}`,
    `${indent}}`,
  ].join('\n');
}

function fmtRegionsFile(regions) {
  if (!regions.length) return '[]';
  return `[\n${regions.map((r) => fmtRegion(r, '  ')).join(',\n')}\n]`;
}

async function copyText(text, button) {
  try {
    await navigator.clipboard.writeText(text);
  } catch (err) {
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
  }
  if (button) {
    const old = button.textContent;
    button.textContent = 'Copied!';
    setTimeout(() => { button.textContent = old; }, 1200);
  }
}

// ---- the editor ------------------------------------------------------------------------------------------
async function initEditor() {
  const canvas = document.getElementById('edCanvas');
  const panel = document.getElementById('edPanel');
  if (!canvas || !panel) return;

  const [regionData, placementData, locationData, campaignData, palette] = await Promise.all([
    loadCards('data/regions.json'),
    loadCards('data/map.json'),
    loadCards('data/locations.json'),
    loadCards('data/campaigns.json'),
    loadPalette(),
  ]);

  // the working copy — every edit changes this, never the files themselves
  const ed = {
    tool: 'place',
    regionDrag: 'paint',
    erase: false,
    coords: false,
    regions: regionData.map((r) => ({
      id: r.id,
      title: r.title || '',
      colorMain: r.colorMain,
      colorSecondary: r.colorSecondary || r.colorMain,
      text: r.text || '',
      hexes: (r.hexes || []).map(([q, rr]) => [q, rr]),
    })),
    placements: placementData.map((p) => ({ location: p.location, q: p.q, r: p.r })),
    locations: locationData.map((l) => ({ ...l })),
    campaigns: campaignData,
    regionIndex: new Map(),
    selectedHex: null,
    regionSel: new Set(),
    editingRegionId: null,
    regionForm: { title: '', colorMain: '#4a7fb5', colorSecondary: lighten('#4a7fb5', 0.45), text: '' },
    secondaryTouched: false,
    placeTab: 'attach',
    attachFilter: '',
    editingLocationId: null,
    moving: null,
    error: '',
    output: [],
    dirty: false,
    // created in this session, so not necessarily in your files yet (used to word the instructions honestly)
    fresh: { locations: new Set(), placements: new Set(), regions: new Set() },
    // what you've typed into the location forms, kept across re-renders so an error never wipes it
    drafts: {},
  };

  const locationOf = (id) => ed.locations.find((l) => l.id === id);
  const placementAt = (q, r) => ed.placements.find((p) => p.q === q && p.r === r);
  const placedIds = () => new Set(ed.placements.map((p) => p.location));
  const campaignTitle = (id) => { const c = ed.campaigns.find((x) => x.id === id); return c ? c.title : id; };
  const colorOf = (c) => resolveColor(c, palette);
  const toColorInput = (c) => {
    const v = colorOf(c);
    if (/^#[0-9a-f]{6}$/i.test(v)) return v.toLowerCase();
    const short = /^#([0-9a-f]{3})$/i.exec(v);
    return short ? `#${short[1].split('').map((x) => x + x).join('')}`.toLowerCase() : ED_GRAY;
  };

  const markDirty = () => {
    ed.dirty = true;
    document.getElementById('edStatus').textContent = '\u25cf unsaved edits — copy the JSON below into your repo';
  };

  // ---- canvas ------------------------------------------------------------------------------------------
  const engine = new HexMap(canvas, { onHexClick, onPaint, onHover });

  function syncEngine() {
    ed.regionIndex = new Map();
    ed.regions.forEach((reg) => reg.hexes.forEach(([q, r]) => ed.regionIndex.set(hexKey(q, r), reg)));
    engine.setRegions(ed.regions.map((r) => ({ colorMain: colorOf(r.colorMain), colorSecondary: colorOf(r.colorSecondary), hexes: r.hexes })));
    const dots = new Map();
    ed.placements.forEach((p) => {
      const loc = locationOf(p.location);
      const key = hexKey(p.q, p.r);
      const region = engine.regionByKey.get(key);
      dots.set(key, { color: region ? region.colorSecondary : ED_GRAY, label: loc ? loc.title : p.location });
    });
    engine.setDots(dots);
    engine.selection = ed.tool === 'region' ? ed.regionSel : new Set();
    engine.selected = ed.tool === 'place' ? ed.selectedHex : null;
    engine.showCoords = ed.coords;
    engine.requestDraw();
  }

  function contentKeys() {
    return [...ed.placements.map((p) => hexKey(p.q, p.r)), ...ed.regions.flatMap((r) => r.hexes.map(([q, rr]) => hexKey(q, rr)))];
  }

  function onHover(q, r) {
    const hud = document.getElementById('edHud');
    if (q === null || q === undefined) { hud.textContent = ''; return; }
    const reg = ed.regionIndex.get(hexKey(q, r));
    const p = placementAt(q, r);
    hud.textContent = `Hex ${q}, ${r}${reg ? ` · ${reg.title}` : ''}${p ? ` · ${(locationOf(p.location) || {}).title || p.location}` : ''}`;
  }

  function onPaint(q, r, erase) {
    if (ed.tool !== 'region') return;
    const key = hexKey(q, r);
    if (erase) ed.regionSel.delete(key); else ed.regionSel.add(key);
    updateSelCount();
    engine.requestDraw();
  }

  function onHexClick(q, r) {
    ed.error = '';
    if (ed.tool === 'region') {
      const key = hexKey(q, r);
      if (ed.regionSel.has(key)) ed.regionSel.delete(key); else ed.regionSel.add(key);
      updateSelCount();
      engine.requestDraw();
      return;
    }
    if (ed.moving) { doMove(q, r); return; }
    ed.selectedHex = [q, r];
    ed.editingLocationId = null;
    Object.keys(ed.drafts).filter((k) => k.indexOf('edit:') === 0).forEach((k) => { delete ed.drafts[k]; });
    syncEngine();
    renderPanel();
  }

  // ---- location actions ----------------------------------------------------------------------------------
  function attachExisting(q, r, id) {
    ed.error = '';
    if (!id) { ed.error = 'Pick a location from the list first.'; renderPanel(); return; }
    if (placementAt(q, r)) { ed.error = 'That hex already has a location.'; renderPanel(); return; }
    const placement = { location: id, q, r };
    ed.placements.push(placement);
    ed.fresh.placements.add(id);
    markDirty();
    ed.output = [{
      title: 'Add to data/map.json',
      note: 'Add this entry to the array in data/map.json (put a comma between entries). The location already exists, so nothing else changes.',
      text: fmtPlacement(placement),
    }];
    syncEngine();
    renderPanel();
  }

  function createAndPlace(q, r, data) {
    ed.error = '';
    const taken = new Set(ed.locations.map((l) => l.id));
    if (!data.title) { ed.error = 'Give the location a title.'; renderPanel(); return; }
    if (!/^[a-z0-9-]+$/.test(data.id)) { ed.error = 'The ID can only use lowercase letters, numbers and dashes.'; renderPanel(); return; }
    if (taken.has(data.id)) { ed.error = `A location with the ID "${data.id}" already exists.`; renderPanel(); return; }
    if (placementAt(q, r)) { ed.error = 'That hex already has a location.'; renderPanel(); return; }
    const loc = { id: data.id, campaign: data.campaign, title: data.title, parent: data.parent, color: data.color, text: data.text };
    delete ed.drafts.create;
    ed.fresh.locations.add(loc.id);
    ed.fresh.placements.add(loc.id);
    ed.locations.push(loc);
    const placement = { location: loc.id, q, r };
    ed.placements.push(placement);
    markDirty();
    ed.output = [
      { title: 'Add to data/locations.json', note: 'A brand new location: add this object to the array in data/locations.json.', text: JSON.stringify(loc, null, 2) },
      { title: 'Add to data/map.json', note: 'And put it on the map: add this entry to the array in data/map.json.', text: fmtPlacement(placement) },
    ];
    syncEngine();
    renderPanel();
  }

  function updateLocation(loc, data) {
    ed.error = '';
    if (!data.title) { ed.error = 'Give the location a title.'; renderPanel(); return; }
    if (data.parent === loc.id) { ed.error = 'A location cannot be its own parent.'; renderPanel(); return; }
    loc.title = data.title;
    loc.campaign = data.campaign;
    loc.parent = data.parent;
    loc.color = data.color;
    loc.text = data.text;
    delete ed.drafts[`edit:${loc.id}`];
    ed.editingLocationId = null;
    markDirty();
    const freshLoc = ed.fresh.locations.has(loc.id);
    ed.output = [{
      title: `${freshLoc ? 'Add or replace' : 'Replace'} in data/locations.json`,
      note: freshLoc
        ? `You created "${loc.id}" earlier in this session. If you already pasted it, replace its entry with this version; if not, add this version instead of the earlier snippet.`
        : `Replace the existing entry for "${loc.id}" in data/locations.json with this one.`,
      text: JSON.stringify(loc, null, 2),
    }];
    syncEngine();
    renderPanel();
  }

  function doMove(q, r) {
    const placement = ed.placements.find((p) => p.location === ed.moving);
    if (!placement) { ed.moving = null; renderPanel(); return; }
    if (placement.q === q && placement.r === r) { ed.moving = null; renderPanel(); return; }
    if (placementAt(q, r)) { ed.error = 'That hex already has a location — pick an empty one.'; renderPanel(); return; }
    const old = { ...placement };
    placement.q = q;
    placement.r = r;
    ed.moving = null;
    ed.selectedHex = [q, r];
    markDirty();
    const freshPlacement = ed.fresh.placements.has(placement.location);
    ed.output = [{
      title: `${freshPlacement ? 'Add or replace' : 'Replace'} in data/map.json`,
      note: freshPlacement
        ? `You placed "${placement.location}" earlier in this session. If you already pasted its entry (${fmtPlacement(old)}), replace it with this one; if not, just add this one.`
        : `Replace the entry for "${placement.location}" (it was ${fmtPlacement(old)}) with this one.`,
      text: fmtPlacement(placement),
    }];
    syncEngine();
    renderPanel();
  }

  function removeFromMap(placement) {
    if (!window.confirm('Take this location off the map? (It stays in locations.json.)')) return;
    ed.placements = ed.placements.filter((p) => p !== placement);
    markDirty();
    ed.output = [{
      title: 'Delete from data/map.json',
      note: ed.fresh.placements.has(placement.location)
        ? 'You placed this earlier in this session. If you already pasted the entry, delete it from data/map.json; if not, simply do not add it. The location itself stays in data/locations.json.'
        : 'Delete this entry from data/map.json. The location itself stays in data/locations.json.',
      text: fmtPlacement(placement),
    }];
    syncEngine();
    renderPanel();
  }

  // ---- region actions ----------------------------------------------------------------------------------------
  const selectionText = () => `${ed.regionSel.size} hex${ed.regionSel.size === 1 ? '' : 'es'} selected`;
  function updateSelCount() {
    const el = document.getElementById('edSelCount');
    if (el) el.textContent = selectionText();
  }

  function loadRegion(id) {
    const reg = ed.regions.find((r) => r.id === id);
    if (!reg) return;
    ed.regionSel = new Set(reg.hexes.map(([q, r]) => hexKey(q, r)));
    ed.editingRegionId = id;
    ed.regionForm = { title: reg.title, colorMain: toColorInput(reg.colorMain), colorSecondary: toColorInput(reg.colorSecondary), text: reg.text || '' };
    ed.secondaryTouched = true;
    ed.error = '';
    engine.fit(reg.hexes.map(([q, r]) => hexKey(q, r)));
    syncEngine();
    renderPanel();
  }

  function newRegionForm() {
    ed.editingRegionId = null;
    ed.regionForm = { title: '', colorMain: '#4a7fb5', colorSecondary: lighten('#4a7fb5', 0.45), text: '' };
    ed.secondaryTouched = false;
    renderPanel();
  }

  function saveRegion() {
    ed.error = '';
    const form = ed.regionForm;
    if (!ed.regionSel.size) { ed.error = 'Select some hexes first (paint them on the map).'; renderPanel(); return; }
    if (!form.title.trim()) { ed.error = 'Give the region a title.'; renderPanel(); return; }

    const hexes = Array.from(ed.regionSel).map(parseHexKey);
    let target = ed.editingRegionId ? ed.regions.find((r) => r.id === ed.editingRegionId) : null;
    if (!target) {
      target = { id: uniqueId(slugify(form.title), new Set(ed.regions.map((r) => r.id))), title: '', colorMain: '', colorSecondary: '', text: '', hexes: [] };
      ed.regions.push(target);
    }
    const wasFresh = ed.fresh.regions.has(target.id);
    const inFile = regionData.some((r) => r.id === target.id);
    target.title = form.title.trim();
    target.colorMain = form.colorMain;
    target.colorSecondary = form.colorSecondary;
    target.text = form.text;
    target.hexes = hexes;

    // a hex can only be in one region: take these away from all the others
    const claimed = new Set(ed.regionSel);
    const changed = [];
    ed.regions.forEach((reg) => {
      if (reg === target) return;
      const before = reg.hexes.length;
      reg.hexes = reg.hexes.filter(([q, r]) => !claimed.has(hexKey(q, r)));
      if (reg.hexes.length !== before) changed.push(reg);
    });
    const emptied = changed.filter((r) => !r.hexes.length);
    ed.regions = ed.regions.filter((r) => !emptied.includes(r));
    const stillThere = changed.filter((r) => r.hexes.length);

    ed.editingRegionId = target.id;
    markDirty();
    const verb = inFile ? 'Replace' : (wasFresh ? 'Add or replace' : 'Add');
    if (!inFile) ed.fresh.regions.add(target.id);
    ed.output = [{
      title: `${verb} in data/regions.json`,
      note: inFile
        ? `This is the complete entry for "${target.title}". Replace the existing entry with the same "id" in data/regions.json.`
        : (wasFresh
          ? `You created "${target.title}" earlier in this session. If you already pasted it, replace its entry with this version; if not, add this version instead of the earlier snippet.`
          : `This is the complete entry for "${target.title}". Add it to the array in data/regions.json.`),
      text: fmtRegion(target),
    }];
    stillThere.forEach((reg) => ed.output.push({
      title: `Also replace: ${reg.title}`,
      note: `"${reg.title}" lost some hexes to the region above, so replace its entry too.`,
      text: fmtRegion(reg),
    }));
    emptied.forEach((reg) => ed.output.push({
      title: `Also delete: ${reg.title}`,
      note: `"${reg.title}" has no hexes left. Delete its entry (id "${reg.id}") from data/regions.json.`,
      text: `"${reg.id}"`,
    }));
    syncEngine();
    renderPanel();
  }

  function deleteRegion(id) {
    const reg = ed.regions.find((r) => r.id === id);
    if (!reg || !window.confirm(`Delete the region "${reg.title}"? Its hexes become regionless.`)) return;
    ed.regions = ed.regions.filter((r) => r !== reg);
    if (ed.editingRegionId === id) newRegionForm();
    markDirty();
    ed.output = [{
      title: 'Delete from data/regions.json',
      note: ed.fresh.regions.has(reg.id)
        ? `You created "${reg.title}" earlier in this session. If you already pasted it, delete the entry with id "${reg.id}" from data/regions.json; if not, simply do not add it. Locations inside it turn gray.`
        : `Delete the entry with id "${reg.id}" from data/regions.json. Locations inside it simply turn gray.`,
      text: `"${reg.id}"`,
    }];
    syncEngine();
    renderPanel();
  }

  // ---- panel -----------------------------------------------------------------------------------------------------
  const field = (label, input) => h('label', { class: 'ed-field' }, h('span', { class: 'ed-field__label', text: label }), input);
  const btn = (text, onclick, cls) => h('button', { class: `ed-btn${cls ? ` ${cls}` : ''}`, type: 'button', text, onclick });

  function regionChip(q, r) {
    const reg = ed.regionIndex.get(hexKey(q, r));
    return h('span', { class: 'ed-chip', style: reg ? `--chip: ${colorOf(reg.colorMain)}` : null, text: reg ? `Region: ${reg.title}` : 'No region' });
  }

  // The form remembers what you type (in ed.drafts) so a validation error
  // never wipes it. The draft is thrown away once the action succeeds.
  function locationForm(loc) {
    const key = loc ? `edit:${loc.id}` : 'create';
    if (!ed.drafts[key]) {
      ed.drafts[key] = {
        title: loc ? loc.title : '',
        id: loc ? loc.id : '',
        idTouched: !!loc,
        campaign: loc ? loc.campaign : (ed.campaigns[0] ? ed.campaigns[0].id : ''),
        parent: loc ? loc.parent : 'self',
        color: loc ? toColorInput(loc.color) : ED_GRAY,
        text: loc ? (loc.text || '') : '',
      };
    }
    const d = ed.drafts[key];
    const taken = new Set(ed.locations.map((l) => l.id));
    const title = h('input', { class: 'ed-input', type: 'text', value: d.title });
    const id = h('input', { class: 'ed-input', type: 'text', value: d.id, readonly: !!loc });
    title.addEventListener('input', () => {
      d.title = title.value;
      if (!loc && !d.idTouched) { d.id = uniqueId(slugify(title.value), taken); id.value = d.id; }
    });
    id.addEventListener('input', () => { d.id = id.value; d.idTouched = true; });
    const campaign = h('select', { class: 'ed-select' }, ed.campaigns.map((c) => h('option', { value: c.id, text: c.title })));
    campaign.value = d.campaign;
    campaign.addEventListener('change', () => { d.campaign = campaign.value; });
    const parent = h('select', { class: 'ed-select' },
      h('option', { value: 'self', text: 'None (a root location)' }),
      ed.locations.filter((l) => !loc || l.id !== loc.id).map((l) => h('option', { value: l.id, text: l.title })));
    parent.value = d.parent;
    parent.addEventListener('change', () => { d.parent = parent.value; });
    const color = h('input', { class: 'ed-input ed-input--color', type: 'color', value: d.color });
    color.addEventListener('input', () => { d.color = color.value; });
    const text = h('textarea', { class: 'ed-textarea', value: d.text });
    text.addEventListener('input', () => { d.text = text.value; });
    return {
      el: h('div', {}, field('Title', title), field('ID', id), h('div', { class: 'ed-row' }, field('Campaign', campaign), field('Parent', parent)), field('Colour', color), field('Text', text)),
      read: () => ({ title: title.value.trim(), id: id.value.trim(), campaign: campaign.value, parent: parent.value, color: color.value, text: text.value }),
    };
  }

  function emptyHexPanel(q, r) {
    const wrap = h('div', {});
    wrap.append(h('div', { class: 'ed-tabs' },
      btn('Attach existing', () => { ed.placeTab = 'attach'; renderPanel(); }, ed.placeTab === 'attach' ? 'is-active' : ''),
      btn('Create new', () => { ed.placeTab = 'create'; renderPanel(); }, ed.placeTab === 'create' ? 'is-active' : '')));

    if (ed.placeTab === 'attach') {
      const unplaced = ed.locations.filter((l) => !placedIds().has(l.id));
      if (!unplaced.length) {
        wrap.append(h('p', { class: 'ed-note', text: 'Every location is already on the map. Use "Create new" to add another.' }));
        return wrap;
      }
      const select = h('select', { class: 'ed-select', size: '9' });
      const fill = () => {
        select.innerHTML = '';
        const q2 = ed.attachFilter.toLowerCase();
        unplaced.filter((l) => (l.title || '').toLowerCase().includes(q2)).forEach((l) => {
          select.append(h('option', { value: l.id, text: `${l.title} — ${campaignTitle(l.campaign)}` }));
        });
        if (select.options.length) select.selectedIndex = 0;
      };
      fill();
      wrap.append(
        field('Filter', h('input', { class: 'ed-input', type: 'search', placeholder: 'Type to filter…', value: ed.attachFilter, oninput: (e) => { ed.attachFilter = e.target.value; fill(); } })),
        select,
        h('p', { class: 'ed-note', text: 'Only locations that are not on the map yet are listed. Placing one only needs an entry for data/map.json.' }),
        btn('Place here', () => attachExisting(q, r, select.value), 'ed-btn--primary'));
    } else {
      const form = locationForm(null);
      wrap.append(form.el,
        h('p', { class: 'ed-note', text: 'This gives you two things to paste: the new location (for data/locations.json) and its map entry (for data/map.json).' }),
        btn('Create & place here', () => createAndPlace(q, r, form.read()), 'ed-btn--primary'));
    }
    return wrap;
  }

  function placedLocationPanel(placement) {
    const loc = locationOf(placement.location);
    const wrap = h('div', {});
    if (!loc) {
      wrap.append(h('p', { class: 'ed-error', text: `map.json places "${placement.location}", which isn't in locations.json.` }),
        btn('Remove from map', () => removeFromMap(placement), 'ed-btn--danger'));
      return wrap;
    }
    const parent = locationOf(loc.parent);
    wrap.append(
      h('h3', { class: 'ed-h ed-h--small', text: loc.title }),
      h('p', { class: 'ed-note', text: `${campaignTitle(loc.campaign)} · ${loc.parent === 'self' ? 'Root location' : (parent ? `Part of ${parent.title}` : loc.parent)} · id: ${loc.id}` }));
    if (ed.editingLocationId === loc.id) {
      const form = locationForm(loc);
      wrap.append(form.el, h('div', { class: 'ed-row' },
        btn('Update location', () => updateLocation(loc, form.read()), 'ed-btn--primary'),
        btn('Cancel', () => { delete ed.drafts[`edit:${loc.id}`]; ed.editingLocationId = null; renderPanel(); })));
    } else {
      wrap.append(h('div', { class: 'ed-row' },
        btn('Edit details', () => { ed.editingLocationId = loc.id; renderPanel(); }),
        btn('Move…', () => { ed.moving = loc.id; ed.error = ''; renderPanel(); }),
        btn('Remove from map', () => removeFromMap(placement), 'ed-btn--danger')));
    }
    return wrap;
  }

  function placePanel() {
    const sec = h('section', { class: 'ed-sec' });
    if (ed.moving) {
      const loc = locationOf(ed.moving);
      sec.append(h('h2', { class: 'ed-h', text: 'Move location' }),
        h('p', { class: 'ed-note', text: `Click the hex you want to move "${loc ? loc.title : ed.moving}" to.` }),
        btn('Cancel move', () => { ed.moving = null; renderPanel(); }));
      return sec;
    }
    if (!ed.selectedHex) {
      sec.append(h('h2', { class: 'ed-h', text: 'Locations' }),
        h('p', { class: 'ed-note', text: 'Click a hex to select it. On an empty hex you can attach an existing location or create a new one; on a hex with a location you can edit, move or remove it.' }));
      return sec;
    }
    const [q, r] = ed.selectedHex;
    const placed = placementAt(q, r);
    sec.append(h('h2', { class: 'ed-h', text: `Hex ${q}, ${r}` }), regionChip(q, r), placed ? placedLocationPanel(placed) : emptyHexPanel(q, r));
    return sec;
  }

  function regionPanel() {
    const form = ed.regionForm;
    const sec = h('section', { class: 'ed-sec' });
    sec.append(
      h('h2', { class: 'ed-h', text: 'Regions' }),
      h('p', { class: 'ed-note', text: 'Paint hexes on the map (top bar: Drag = paint, Brush = add or erase), then name the selection and pick its colours. A hex can only be in one region.' }),
      h('div', { class: 'ed-row' }, h('span', { id: 'edSelCount', text: selectionText() }),
        btn('Clear selection', () => { ed.regionSel.clear(); updateSelCount(); engine.requestDraw(); })));

    const title = h('input', { class: 'ed-input', type: 'text', value: form.title, oninput: (e) => { form.title = e.target.value; } });
    const secondary = h('input', { class: 'ed-input ed-input--color', type: 'color', value: form.colorSecondary, oninput: (e) => { form.colorSecondary = e.target.value; ed.secondaryTouched = true; } });
    const main = h('input', {
      class: 'ed-input ed-input--color',
      type: 'color',
      value: form.colorMain,
      oninput: (e) => {
        form.colorMain = e.target.value;
        if (!ed.secondaryTouched) { form.colorSecondary = lighten(form.colorMain, 0.45); secondary.value = form.colorSecondary; }
      },
    });
    const text = h('textarea', { class: 'ed-textarea', value: form.text, oninput: (e) => { form.text = e.target.value; } });
    sec.append(
      field('Title', title),
      h('div', { class: 'ed-row' }, field('Main colour (fill)', main), field('Secondary (location dots)', secondary)),
      field('Description', text),
      h('div', { class: 'ed-row' },
        btn(ed.editingRegionId ? 'Update region' : 'Create region from selection', saveRegion, 'ed-btn--primary'),
        btn('New region', newRegionForm)));

    sec.append(h('h3', { class: 'ed-h ed-h--small', text: 'All regions' }));
    if (!ed.regions.length) {
      sec.append(h('p', { class: 'ed-note', text: 'No regions yet.' }));
    } else {
      sec.append(h('ul', { class: 'ed-regionlist' }, ed.regions.map((reg) => h('li', { class: 'ed-regionlist__item' },
        h('span', { class: 'ed-regionlist__swatch', style: `--swatch: ${colorOf(reg.colorMain)}` }),
        h('span', { class: 'ed-regionlist__name', text: reg.title }),
        h('span', { class: 'ed-regionlist__count', text: `${reg.hexes.length} hex${reg.hexes.length === 1 ? '' : 'es'}` }),
        btn('Edit', () => loadRegion(reg.id)),
        btn('Delete', () => deleteRegion(reg.id), 'ed-btn--danger')))));
    }
    return sec;
  }

  function codeBlock(item) {
    const area = h('textarea', { class: 'ed-out__code', readonly: true, spellcheck: 'false' });
    area.value = item.text;
    return h('div', { class: 'ed-out' },
      item.title ? h('p', { class: 'ed-out__title', text: item.title }) : null,
      item.note ? h('p', { class: 'ed-out__note', text: item.note }) : null,
      area,
      h('div', { class: 'ed-row' }, btn('Copy', (e) => copyText(area.value, e.target)), btn('Select all', () => { area.focus(); area.select(); })));
  }

  function outputPanel() {
    const sec = h('section', { class: 'ed-sec' });
    if (!ed.output.length) return sec;
    sec.append(h('h2', { class: 'ed-h', text: 'Copy this' }), ...ed.output.map(codeBlock),
      btn('Dismiss', () => { ed.output = []; renderPanel(); }));
    return sec;
  }

  function fullFilesPanel() {
    return h('details', { class: 'ed-details' },
      h('summary', { text: 'Full files (everything as it stands now)' }),
      h('div', { class: 'ed-details__body' },
        h('p', { class: 'ed-note', text: 'Use these if you would rather replace a whole file than patch single entries. For locations.json this re-writes the entire file, so only use it if you are happy with that.' }),
        codeBlock({ title: 'data/map.json', note: '', text: fmtMapFile(ed.placements) }),
        codeBlock({ title: 'data/regions.json', note: '', text: fmtRegionsFile(ed.regions) }),
        codeBlock({ title: 'data/locations.json', note: '', text: JSON.stringify(ed.locations, null, 2) })));
  }

  function renderPanel() {
    panel.innerHTML = '';
    if (ed.error) panel.append(h('p', { class: 'ed-error', text: ed.error }));
    panel.append(ed.tool === 'place' ? placePanel() : regionPanel(), outputPanel(), fullFilesPanel());
  }

  // ---- top bar ------------------------------------------------------------------------------------------------------
  const dragBtn = document.getElementById('edDragMode');
  const brushBtn = document.getElementById('edBrush');
  const coordsBtn = document.getElementById('edCoords');

  function renderTopBar() {
    dragBtn.textContent = `Drag: ${ed.regionDrag}`;
    brushBtn.textContent = `Brush: ${ed.erase ? 'erase' : 'add'}`;
    coordsBtn.textContent = `Coordinates: ${ed.coords ? 'on' : 'off'}`;
    document.querySelectorAll('#edTools .ed-btn').forEach((b) => b.classList.toggle('is-active', b.dataset.tool === ed.tool));
    document.getElementById('edRegionTools').hidden = ed.tool !== 'region';
  }

  function setTool(tool) {
    ed.tool = tool;
    ed.error = '';
    ed.moving = null;
    engine.dragMode = tool === 'region' ? ed.regionDrag : 'pan';
    renderTopBar();
    syncEngine();
    renderPanel();
  }

  document.querySelectorAll('#edTools .ed-btn').forEach((b) => b.addEventListener('click', () => setTool(b.dataset.tool)));
  dragBtn.addEventListener('click', () => {
    ed.regionDrag = ed.regionDrag === 'paint' ? 'pan' : 'paint';
    engine.dragMode = ed.regionDrag;
    renderTopBar();
  });
  brushBtn.addEventListener('click', () => {
    ed.erase = !ed.erase;
    engine.paintErase = ed.erase;
    renderTopBar();
  });
  coordsBtn.addEventListener('click', () => {
    ed.coords = !ed.coords;
    renderTopBar();
    syncEngine();
  });
  document.getElementById('edFit').addEventListener('click', () => engine.fit(contentKeys()));
  document.getElementById('edZoomIn').addEventListener('click', () => engine.zoomBy(1.4));
  document.getElementById('edZoomOut').addEventListener('click', () => engine.zoomBy(1 / 1.4));
  window.addEventListener('beforeunload', (e) => {
    if (ed.dirty) { e.preventDefault(); e.returnValue = ''; }
  });

  engine.fit(contentKeys());
  renderTopBar();
  syncEngine();
  renderPanel();
  window.__mapEditor = { engine, ed };
}

document.addEventListener('DOMContentLoaded', initEditor);
