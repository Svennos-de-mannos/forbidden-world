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

  function renderScenes() {
    root.dataset.scene = state.scene;
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
