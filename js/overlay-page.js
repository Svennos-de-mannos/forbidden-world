// OBS overlay for online sessions. Add overlay.html to OBS as a Browser
// Source (1920 x 1300), crop the bottom 220px, and drive it through the
// source's "Interact" window.
//
// There's no backend: OBS renders this one page, and Interact clicks the
// very same page, so everything lives right here. The settings are saved
// in the browser's localStorage (inside OBS) so a restart or a refresh
// doesn't lose the scene, header text or roster.

const OVERLAY_CAMPAIGN = 'openeyes'; // whose players fill the roster
const OVERLAY_SLOT_COUNT = 6;
const OVERLAY_W = 1920;
const OVERLAY_H = 1300; // 1080 visible + 220 control strip
const OVERLAY_STORAGE_KEY = 'forbidden-world-overlay-v1';

const SCENES = [
  { id: 'normal',    label: 'Normal',  tag: '',          swatch: '#d9a927' },
  { id: 'cozy',      label: 'Cozy',    tag: 'Cozy',      swatch: '#f2a65a' },
  { id: 'exploring', label: 'Explore', tag: 'Exploring', swatch: '#4fd6cf' },
  { id: 'combat',    label: 'Combat',  tag: 'Combat',    swatch: '#ff5b2e' },
  { id: 'horror',    label: 'Danger',  tag: 'Danger',    swatch: '#c4222f' },
  { id: 'city',      label: 'The City', tag: 'The City', swatch: '#8fb06a' },
  { id: 'eldritch',  label: 'Eldritch', tag: 'Eldritch', swatch: '#b07cff' },
];

function makeEl(tag, className, text) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text !== undefined) el.textContent = text;
  return el;
}

// ---- saved state -------------------------------------------------------------------------
function defaultState() {
  return { scene: 'normal', location: '', goal: '', showEmpty: true, slots: Array(OVERLAY_SLOT_COUNT).fill(null) };
}

function loadState() {
  const state = defaultState();
  try {
    const saved = JSON.parse(localStorage.getItem(OVERLAY_STORAGE_KEY) || 'null');
    if (saved) {
      if (SCENES.some((s) => s.id === saved.scene)) state.scene = saved.scene;
      state.location = String(saved.location || '');
      state.goal = String(saved.goal || '');
      state.showEmpty = saved.showEmpty !== false;
      if (Array.isArray(saved.slots)) {
        state.slots = Array.from({ length: OVERLAY_SLOT_COUNT }, (_, i) => saved.slots[i] || null);
      }
    }
  } catch (err) {
    // storage unavailable or corrupted — just start fresh
  }
  return state;
}

// "#ffffff" -> dark ink, "#4A2306" -> light ink, so the initial letter
// on a character's colored tile is always readable.
function inkFor(color) {
  let m = /^#([0-9a-f]{6})$/i.exec(color || '');
  if (!m) {
    const short = /^#([0-9a-f]{3})$/i.exec(color || '');
    if (!short) return '#efe6d8';
    m = [null, short[1].split('').map((c) => c + c).join('')];
  }
  const n = parseInt(m[1], 16);
  const lum = 0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255);
  return lum > 150 ? '#0a0a09' : '#efe6d8';
}

// ---- background decoration -------------------------------------------------------------------
// The City scatters blinking eyes, Eldritch scatters runes that fade in and
// out. Items are drawn in the window's outer edge, the header and the roster
// — never in the middle of the window, so your face stays clear. Each item
// jumps to a new spot every time it has faded out.
const DECOR_SCENES = {
  city:     { kind: 'eye',  window: 15, header: 4, roster: 7 },
  eldritch: { kind: 'rune', window: 16, header: 5, roster: 8 },
};

// sizes of the three places decoration can go (px), and the part of the
// window that must stay empty
const DECOR_ZONES = {
  window: { w: 1516, h: 924, avoid: { x1: 270, y1: 170, x2: 1246, y2: 754 } },
  header: { w: 1872, h: 92 },
  roster: { w: 340, h: 924 },
};

// Simple straight-stroke runes drawn by hand (so they look the same on any
// computer — no font needed). Each is drawn inside a 26 x 40 box.
const RUNES = [
  'M12 4V36',
  'M8 36V4M8 14L20 6M8 24L20 16',
  'M8 36V4L20 16V36',
  'M8 36V4M8 12L20 20L8 28',
  'M8 36V4L20 12M8 16L20 24',
  'M8 36V4L18 12L8 22M8 22L20 36',
  'M20 8L8 20L20 32',
  'M6 6L20 34M20 6L6 34',
  'M8 36V4L18 12L8 20',
  'M8 4V36M20 4V36M8 14L20 26',
  'M12 4V36M6 16L18 26',
  'M12 36V8M12 20L4 8M12 20L20 8',
  'M16 4L8 14L16 22L8 34',
  'M12 36V4M4 14L12 4L20 14',
  'M8 4V36M8 4L18 12L8 20L18 28L8 36',
  'M6 36V4M20 36V4M6 4L13 14L20 4',
  'M12 4L20 14L12 24L4 14ZM4 36L12 24L20 36',
  'M6 6V34M20 6V34M6 6L20 34M20 6L6 34',
];

const EYE_SHAPE = 'M2 17C14 2 46 2 58 17C46 32 14 32 2 17Z';
const SVG_NS = 'http://www.w3.org/2000/svg';
const rand = (a, b) => a + Math.random() * (b - a);

function svgEl(name, attrs) {
  const el = document.createElementNS(SVG_NS, name);
  Object.keys(attrs || {}).forEach((k) => el.setAttribute(k, attrs[k]));
  return el;
}

// the eye shape, reused to keep the iris inside the eyelids
function ensureEyeClip() {
  if (document.getElementById('ovEyeClip')) return;
  const holder = svgEl('svg', { width: '0', height: '0', 'aria-hidden': 'true' });
  holder.style.position = 'absolute';
  const clip = svgEl('clipPath', { id: 'ovEyeClip' });
  clip.appendChild(svgEl('path', { d: EYE_SHAPE }));
  holder.appendChild(svgEl('defs')).appendChild(clip);
  document.body.appendChild(holder);
}

function buildEye() {
  const svg = svgEl('svg', { viewBox: '0 0 60 34' });
  svg.appendChild(svgEl('path', { d: EYE_SHAPE, class: 'ov-eye__white' }));
  const clipped = svgEl('g', { 'clip-path': 'url(#ovEyeClip)' });
  const pupil = svgEl('g', { class: 'ov-eye__pupil' });
  pupil.appendChild(svgEl('circle', { cx: '30', cy: '17', r: '10', class: 'ov-eye__iris' }));
  pupil.appendChild(svgEl('ellipse', { cx: '30', cy: '17', rx: '2.4', ry: '9', class: 'ov-eye__slit' }));
  clipped.appendChild(pupil);
  svg.appendChild(clipped);
  svg.appendChild(svgEl('path', { d: EYE_SHAPE, class: 'ov-eye__lid' }));
  return svg;
}

function setRuneGlyph(svg) {
  const d = RUNES[Math.floor(Math.random() * RUNES.length)];
  svg.querySelectorAll('path').forEach((p) => p.setAttribute('d', d));
}

function buildRune() {
  const svg = svgEl('svg', { viewBox: '0 0 26 40' });
  svg.appendChild(svgEl('path', { class: 'ov-rune__glow' }));
  svg.appendChild(svgEl('path', { class: 'ov-rune__line' }));
  setRuneGlyph(svg);
  return svg;
}

function placeDecor(item, kind, zoneName) {
  const zone = DECOR_ZONES[zoneName];
  const big = zoneName === 'window';
  const width = kind === 'eye' ? (big ? rand(52, 104) : rand(34, 58)) : (big ? rand(26, 52) : rand(18, 30));
  let cx;
  let cy;
  let tries = 0;
  do {
    cx = rand(0, zone.w);
    cy = rand(0, zone.h);
    tries += 1;
  } while (zone.avoid && tries < 40 && cx > zone.avoid.x1 && cx < zone.avoid.x2 && cy > zone.avoid.y1 && cy < zone.avoid.y2);

  // eyes are wider than tall, runes taller than wide — centre on the real size
  const height = kind === 'eye' ? (width * 34) / 60 : (width * 40) / 26;
  item.style.width = `${width}px`;
  item.style.left = `${cx - width / 2}px`;
  item.style.top = `${cy - height / 2}px`;
  item.style.transform = `rotate(${rand(-14, 14)}deg)`;
  if (kind === 'rune') setRuneGlyph(item.firstChild);
}

function buildDecorItem(kind, zoneName) {
  const item = makeEl('span', `ov-decor__item ov-decor__item--${kind}`);
  const svg = kind === 'eye' ? buildEye() : buildRune();
  const dur = kind === 'eye' ? rand(9, 15) : rand(5, 9);
  svg.style.animationDuration = `${dur}s`;
  svg.style.animationDelay = `${-rand(0, dur)}s`; // start mid-cycle so the scene isn't empty at first
  if (kind === 'eye') svg.querySelector('.ov-eye__pupil').style.animationDuration = `${rand(4, 8)}s`;
  item.appendChild(svg);
  placeDecor(item, kind, zoneName);
  // every time it has faded out, jump somewhere new
  item.addEventListener('animationiteration', (e) => {
    if (e.animationName === 'ov-eye' || e.animationName === 'ov-rune') placeDecor(item, kind, zoneName);
  });
  return item;
}

async function initOverlay() {
  const root = document.getElementById('ovRoot');
  const state = loadState();
  let selecting = null; // index of the roster slot being assigned, or null
  let roster = [];      // the characters you can pick from
  let rosterById = {};
  let palette = {};

  const save = () => {
    try { localStorage.setItem(OVERLAY_STORAGE_KEY, JSON.stringify(state)); } catch (err) { /* ignore */ }
  };

  // ---- fit the 1920 x 1300 canvas to whatever size the window is ----------------------------
  // In OBS (source = 1920 x 1300) this is scale 1. In a normal browser tab
  // it just shrinks the whole thing so you can preview it.
  function fit() {
    const s = Math.min(window.innerWidth / OVERLAY_W, window.innerHeight / OVERLAY_H);
    root.style.transform = `scale(${s})`;
  }
  window.addEventListener('resize', fit);
  fit();

  // ---- scene ---------------------------------------------------------------------------------
  const sceneBox = document.getElementById('ovScenes');
  const sceneLabel = document.getElementById('ovSceneLabel');

  // (re)build the background decoration for the current scene
  function renderDecor() {
    const hosts = {
      window: document.querySelector('.ov-window'),
      header: document.querySelector('.ov-header'),
      roster: document.getElementById('ovRoster'),
    };
    const cfg = DECOR_SCENES[state.scene];
    Object.keys(hosts).forEach((zoneName) => {
      const host = hosts[zoneName];
      let layer = host.querySelector(':scope > .ov-decor');
      if (!layer) {
        layer = makeEl('div', 'ov-decor');
        host.insertBefore(layer, host.firstChild);
      }
      layer.innerHTML = '';
      if (!cfg) return;
      if (cfg.kind === 'eye') ensureEyeClip();
      for (let i = 0; i < cfg[zoneName]; i++) layer.appendChild(buildDecorItem(cfg.kind, zoneName));
    });
  }

  function renderScenes() {
    root.dataset.scene = state.scene;
    renderDecor();
    const current = SCENES.find((s) => s.id === state.scene);
    sceneLabel.textContent = current ? current.tag : '';
    sceneBox.querySelectorAll('.ov-scene-btn').forEach((btn) => {
      btn.classList.toggle('is-active', btn.dataset.scene === state.scene);
    });
  }

  SCENES.forEach((scene) => {
    const btn = makeEl('button', 'ov-scene-btn');
    btn.type = 'button';
    btn.dataset.scene = scene.id;
    btn.style.setProperty('--swatch', scene.swatch);
    btn.appendChild(makeEl('span', 'ov-scene-btn__swatch'));
    btn.appendChild(makeEl('span', '', scene.label));
    btn.addEventListener('click', () => {
      state.scene = scene.id;
      save();
      renderScenes();
    });
    sceneBox.appendChild(btn);
  });

  // ---- header text (location + goal) ---------------------------------------------------------
  const inLoc = document.getElementById('ovInLocation');
  const inGoal = document.getElementById('ovInGoal');

  function renderHeader() {
    const locBlock = document.getElementById('ovLocationBlock');
    const goalBlock = document.getElementById('ovGoalBlock');
    document.getElementById('ovLocation').textContent = state.location;
    document.getElementById('ovGoal').textContent = state.goal;
    locBlock.hidden = state.location === '';
    goalBlock.hidden = state.goal === '';
  }

  function applyHeader() {
    state.location = inLoc.value.trim();
    state.goal = inGoal.value.trim();
    save();
    renderHeader();
  }

  inLoc.value = state.location;
  inGoal.value = state.goal;
  document.getElementById('ovSetHeader').addEventListener('click', applyHeader);
  document.getElementById('ovClearHeader').addEventListener('click', () => {
    inLoc.value = '';
    inGoal.value = '';
    applyHeader();
  });
  [inLoc, inGoal].forEach((input) => {
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') applyHeader(); });
  });

  // ---- roster ---------------------------------------------------------------------------------
  const slotsBox = document.getElementById('ovSlots');
  const rosterPanel = document.getElementById('ovRoster');
  const toggleEmpty = document.getElementById('ovToggleEmpty');

  function buildAvatar(person) {
    const color = person ? resolveColor(person.color, palette) : null;
    const avatar = makeEl('span', 'ov-avatar');
    if (!person) {
      avatar.textContent = '+';
      return avatar;
    }
    avatar.style.setProperty('--char', color);
    avatar.style.setProperty('--char-ink', inkFor(color));
    avatar.appendChild(makeEl('span', 'ov-avatar__initial', (person.name || '?').trim().charAt(0).toUpperCase()));
    if (person.image) {
      const img = document.createElement('img');
      img.alt = '';
      img.src = person.image;
      img.addEventListener('error', () => img.remove()); // fall back to the initial
      avatar.appendChild(img);
    }
    return avatar;
  }

  function renderRoster() {
    slotsBox.innerHTML = '';
    for (let i = 0; i < OVERLAY_SLOT_COUNT; i++) {
      const person = rosterById[state.slots[i]] || null;
      const slot = makeEl('button', `ov-slot${person ? '' : ' ov-slot--empty'}${selecting === i ? ' is-selecting' : ''}`);
      slot.type = 'button';
      slot.appendChild(buildAvatar(person));

      const text = makeEl('span', 'ov-slot__text');
      if (person) {
        text.appendChild(makeEl('span', 'ov-slot__name', person.name || ''));
        const meta = [person.race, person.class].filter(Boolean).join(' · ');
        if (meta) text.appendChild(makeEl('span', 'ov-slot__meta', meta));
      } else {
        text.appendChild(makeEl('span', 'ov-slot__meta', 'Empty'));
      }
      slot.appendChild(text);

      slot.addEventListener('click', () => {
        selecting = selecting === i ? null : i;
        renderRoster();
        renderPicker();
      });
      slotsBox.appendChild(slot);
    }
    rosterPanel.classList.toggle('ov-roster--hide-empty', !state.showEmpty);
    toggleEmpty.textContent = `Empty slots: ${state.showEmpty ? 'shown' : 'hidden'}`;
  }

  toggleEmpty.addEventListener('click', () => {
    state.showEmpty = !state.showEmpty;
    save();
    renderRoster();
  });

  // ---- picker (lives in the control strip, so viewers never see it) --------------------------------
  const picker = document.getElementById('ovPicker');

  function assign(slotIndex, personId) {
    // a character can only sit in one slot — move them if they're already placed
    state.slots = state.slots.map((id) => (id === personId ? null : id));
    state.slots[slotIndex] = personId;
    selecting = null;
    save();
    renderRoster();
    renderPicker();
  }

  function renderPicker() {
    picker.innerHTML = '';
    if (selecting === null) {
      picker.appendChild(makeEl('span', 'ov-picker__hint', 'Click a slot on the roster to put a character in it (click a filled slot to change or clear it).'));
      return;
    }
    picker.appendChild(makeEl('span', 'ov-controls__label', `Slot ${selecting + 1}:`));
    roster.forEach((person) => {
      const chip = makeEl('button', `ov-chip${state.slots.includes(person.id) ? ' is-placed' : ''}`, person.name || person.id);
      chip.type = 'button';
      chip.style.setProperty('--char', resolveColor(person.color, palette));
      chip.addEventListener('click', () => assign(selecting, person.id));
      picker.appendChild(chip);
    });
    if (state.slots[selecting]) {
      const clear = makeEl('button', 'ov-btn', 'Clear slot');
      clear.type = 'button';
      clear.addEventListener('click', () => {
        state.slots[selecting] = null;
        selecting = null;
        save();
        renderRoster();
        renderPicker();
      });
      picker.appendChild(clear);
    }
    const cancel = makeEl('button', 'ov-btn', 'Cancel');
    cancel.type = 'button';
    cancel.addEventListener('click', () => {
      selecting = null;
      renderRoster();
      renderPicker();
    });
    picker.appendChild(cancel);
  }

  // ---- first paint: scene + header straight away, roster once the data is in ------------------------
  renderScenes();
  renderHeader();
  renderRoster();
  renderPicker();

  const [campaigns, people, loadedPalette] = await Promise.all([
    loadCards('data/campaigns.json'),
    loadCards('data/npcs.json'),
    loadPalette(),
  ]);
  palette = loadedPalette;

  const campaign = campaigns.find((c) => c.id === OVERLAY_CAMPAIGN);
  if (campaign) document.getElementById('ovCampaignTitle').textContent = campaign.title;

  roster = people.filter((p) => p.kind === 'player' && [].concat(p.campaign || []).includes(OVERLAY_CAMPAIGN));
  rosterById = Object.fromEntries(roster.map((p) => [p.id, p]));
  renderRoster();
  renderPicker();
}

document.addEventListener('DOMContentLoaded', initOverlay);
