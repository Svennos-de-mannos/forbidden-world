// The map viewer (map.html). Read-only: click a hex to see the location on
// it (if there is one) with its region underneath, or just the region for an
// empty hex.
//
// Data: data/regions.json (regions + the hexes they cover), data/map.json
// (which location sits on which hex) and the existing data/locations.json.

const MAP_GRAY = '#8a8578'; // dot colour for a location that isn't inside a region

function makeEl(tag, className, text) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text !== undefined) el.textContent = text;
  return el;
}

async function initMapPage() {
  const canvas = document.getElementById('mapCanvas');
  if (!canvas) return;

  const [regionData, placements, locations, campaigns, palette] = await Promise.all([
    loadCards('data/regions.json'),
    loadCards('data/map.json'),
    loadCards('data/locations.json'),
    loadCards('data/campaigns.json'),
    loadPalette(),
  ]);

  const regions = regionData.map((r) => ({
    id: r.id,
    title: r.title,
    text: r.text,
    colorMain: resolveColor(r.colorMain, palette),
    colorSecondary: resolveColor(r.colorSecondary || r.colorMain, palette),
    hexes: r.hexes || [],
  }));
  const locationById = Object.fromEntries(locations.map((l) => [l.id, l]));
  const campaignById = Object.fromEntries(campaigns.map((c) => [c.id, c]));

  const engine = new HexMap(canvas, { onHexClick: (q, r) => showHex(q, r) });
  engine.setRegions(regions);

  // which location(s) sit on each hex, and the dot drawn for it
  const locationsByKey = new Map();
  const dots = new Map();
  placements.forEach((p) => {
    const loc = locationById[p.location];
    if (!loc) {
      console.warn(`map.json places "${p.location}", which isn't in locations.json — skipped.`);
      return;
    }
    const key = hexKey(p.q, p.r);
    if (!locationsByKey.has(key)) locationsByKey.set(key, []);
    locationsByKey.get(key).push(loc);
    const region = engine.regionByKey.get(key);
    if (!dots.has(key)) dots.set(key, { color: region ? region.colorSecondary : MAP_GRAY, label: loc.title });
  });
  engine.setDots(dots);

  // ---- info panel ------------------------------------------------------------------------------
  const info = document.getElementById('mapInfo');

  function locationBlock(loc) {
    const block = makeEl('section', 'map-info__block');
    block.style.setProperty('--accent', resolveColor(loc.color, palette));
    block.appendChild(makeEl('p', 'map-info__label', 'Location'));
    const title = makeEl('h2', 'map-info__title');
    fillOrPlaceholder(title, loc.title);
    block.appendChild(title);

    const parent = locationById[loc.parent];
    const campaign = campaignById[loc.campaign];
    const meta = [campaign ? campaign.title : '', loc.parent === 'self' ? 'Root location' : (parent ? `Part of ${parent.title}` : '')].filter(Boolean);
    if (meta.length) block.appendChild(makeEl('p', 'map-info__meta', meta.join(' · ')));

    const text = makeEl('p', 'map-info__text');
    fillOrPlaceholder(text, loc.text);
    block.appendChild(text);
    return block;
  }

  function regionBlock(region) {
    const block = makeEl('section', 'map-info__block');
    block.style.setProperty('--accent', region.colorMain);
    block.appendChild(makeEl('p', 'map-info__label', 'Region'));
    const title = makeEl('h2', 'map-info__title');
    fillOrPlaceholder(title, region.title);
    block.appendChild(title);
    const text = makeEl('p', 'map-info__text');
    fillOrPlaceholder(text, region.text);
    block.appendChild(text);
    return block;
  }

  function showHex(q, r) {
    engine.selected = [q, r];
    engine.requestDraw();
    info.innerHTML = '';
    const key = hexKey(q, r);
    const here = locationsByKey.get(key) || [];
    const region = engine.regionByKey.get(key);
    here.forEach((loc) => info.appendChild(locationBlock(loc)));
    if (region) info.appendChild(regionBlock(region));
    if (!here.length && !region) info.appendChild(makeEl('p', 'map-hint', 'Nothing is marked on this hex.'));
  }

  // ---- legend: jump to a region ---------------------------------------------------------------------
  const legend = document.getElementById('mapLegend');
  regions.forEach((region) => {
    if (!region.hexes.length) return;
    const item = makeEl('button', 'map-legend__item');
    item.type = 'button';
    item.style.setProperty('--swatch', region.colorMain);
    item.appendChild(makeEl('span', 'map-legend__swatch'));
    item.appendChild(makeEl('span', '', region.title));
    item.addEventListener('click', () => {
      engine.fit(region.hexes.map(([q, r]) => hexKey(q, r)));
      showHex(region.hexes[0][0], region.hexes[0][1]);
    });
    legend.appendChild(item);
  });

  // ---- controls -------------------------------------------------------------------------------------------
  const contentKeys = [...dots.keys(), ...regions.flatMap((r) => r.hexes.map(([q, r2]) => hexKey(q, r2)))];
  document.getElementById('mapZoomIn').addEventListener('click', () => engine.zoomBy(1.4));
  document.getElementById('mapZoomOut').addEventListener('click', () => engine.zoomBy(1 / 1.4));
  document.getElementById('mapFit').addEventListener('click', () => engine.fit(contentKeys));

  engine.fit(contentKeys);
  if (!contentKeys.length) {
    info.appendChild(makeEl('p', 'map-hint', "The map hasn't been drawn yet."));
  } else {
    info.appendChild(makeEl('p', 'map-hint', 'Tap a hex to see what is there.'));
  }
  window.__mapView = { engine, showHex };
}

document.addEventListener('DOMContentLoaded', initMapPage);
