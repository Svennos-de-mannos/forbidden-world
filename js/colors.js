// Turns a card's `color` value into a real CSS color.
// A card can use:
//   - a hex value:        "#b23148"
//   - a color name that exists in data/colors.json:  "Mintgreen", "grey red"
//   - a normal CSS color name:  "teal"
// Names in data/colors.json win over CSS names, so your palette decides
// what "Darkred" or "Brown" actually looks like on this site.

const DEFAULT_CARD_COLOR = '#8a8578';
let cachedPalette = null;

function normalizeColorKey(name) {
  return String(name || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

async function loadPalette() {
  if (cachedPalette) return cachedPalette;
  const raw = await loadCards('data/colors.json');
  cachedPalette = {};
  if (raw && !Array.isArray(raw)) {
    Object.keys(raw).forEach((key) => {
      cachedPalette[normalizeColorKey(key)] = raw[key];
    });
  }
  return cachedPalette;
}

function resolveColor(value, palette) {
  const v = String(value || '').trim();
  if (!v) return DEFAULT_CARD_COLOR;
  if (v.startsWith('#')) return v;

  const hit = palette[normalizeColorKey(v)];
  if (hit && hit.main) return hit.main;

  if (window.CSS && CSS.supports('color', v)) return v;

  console.warn(`Unknown color "${v}" — add it to data/colors.json or use a hex value like #b23148.`);
  return DEFAULT_CARD_COLOR;
}
