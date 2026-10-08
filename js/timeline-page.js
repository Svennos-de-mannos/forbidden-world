// Builds the Timeline page from data/timeline.json.
//
// Each entry is either:
//   type: "event"   — its own title + text, or
//   type: "session" — a reference (sessionId) into data/sessions.json,
//                      so session recaps are never duplicated here.
//
// Entries sort by `order` (a plain integer you assign — dates are never
// parsed or compared, they're just a label shown on the divider lines).
// A divider is drawn immediately before any entry with a non-empty
// `date`; every entry after it belongs to that date until the next one.

function makeEl(tag, className, text) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text !== undefined) el.textContent = text;
  return el;
}

async function resolveTimelineItems() {
  const [raw, sessions, campaigns, palette] = await Promise.all([
    loadCards('data/timeline.json'),
    loadCards('data/sessions.json'),
    loadCards('data/campaigns.json'),
    loadPalette(),
  ]);
  const sessionById = Object.fromEntries(sessions.map((s) => [s.id, s]));
  const campaignById = Object.fromEntries(campaigns.map((c) => [c.id, c]));

  return raw
    .slice()
    .sort((a, b) => (a.order || 0) - (b.order || 0))
    .map((entry) => {
      const color = resolveColor(entry.color, palette);
      const date = (entry.date || '').trim();

      if (entry.type === 'session') {
        const session = sessionById[entry.sessionId];
        if (!session) {
          console.warn(`Timeline entry (order ${entry.order}) points at missing session "${entry.sessionId}".`);
          return { title: '', text: '', tag: entry.tag || 'Session', color, date };
        }
        const campaignTitle = campaignById[session.campaign] ? campaignById[session.campaign].title : '';
        const metaLabel = session.oneShot ? 'One-shot' : `Session ${session.sessionNumber} · ${campaignTitle}`;
        return {
          title: session.title,
          text: session.text,
          tag: entry.tag || metaLabel,
          color,
          date,
        };
      }

      // type === "event"
      return {
        title: entry.title,
        text: entry.text,
        tag: entry.tag || 'Event',
        color,
        date,
      };
    });
}

function buildTrack(track, items, onSelect, wasDragged) {
  // Fades from neutral gray into the first dot's color.
  const leadIn = makeEl('div', 'tl-end-fade');
  const leadInBar = makeEl('div', 'tl-end-fade__bar');
  leadInBar.style.background = `linear-gradient(to right, var(--tl-gray), ${items[0].color})`;
  leadIn.appendChild(leadInBar);
  track.appendChild(leadIn);

  items.forEach((item, i) => {
    // The connecting segment must exist BEFORE we try to overlay a
    // divider onto it — build it first.
    let segment = null;
    if (i > 0) {
      const prevColor = items[i - 1].color;
      segment = makeEl('div', 'tl-segment');
      const bar = makeEl('div', 'tl-segment__bar');
      bar.style.background = `linear-gradient(to right, ${prevColor}, ${item.color})`;
      segment.appendChild(bar);
      track.appendChild(segment);
    }

    if (item.date) {
      // Overlaid on the segment leading into this entry — or, for the
      // very first entry, on the lead-in fade — so the gradient line
      // stays unbroken underneath.
      const divider = makeEl('span', 'tl-divider');
      divider.appendChild(makeEl('span', 'tl-divider__date', item.date));
      (segment || leadIn).appendChild(divider);
    }

    const col = makeEl('button', 'tl-item');
    col.type = 'button';
    col.dataset.index = String(i);
    col.appendChild(makeEl('span', 'tl-item__labelspacer'));
    const title = makeEl('span', 'tl-item__title');
    const titleText = makeEl('span', 'tl-item__titletext');
    fillOrPlaceholder(titleText, item.title);
    title.appendChild(titleText);
    const dotWrap = makeEl('span', 'tl-item__dotwrap');
    const dot = makeEl('span', 'tl-item__dot');
    dot.style.setProperty('--accent', item.color);
    dotWrap.appendChild(dot);
    col.appendChild(title);
    col.appendChild(dotWrap);
    // Dragging the track shouldn't also fire a selection — only treat
    // this as a real click if the pointer never moved meaningfully.
    col.addEventListener('click', () => {
      if (wasDragged()) return;
      onSelect(i);
    });
    track.appendChild(col);
  });

  // Fades from the last dot's color back to neutral gray.
  const leadOut = makeEl('div', 'tl-end-fade tl-end-fade--out');
  const leadOutBar = makeEl('div', 'tl-end-fade__bar');
  leadOutBar.style.background = `linear-gradient(to right, ${items[items.length - 1].color}, var(--tl-gray))`;
  leadOut.appendChild(leadOutBar);
  track.appendChild(leadOut);
}

// Click-and-drag (mouse) and touch-drag (finger) scrolling for the
// track. Uses the Pointer Events API so one set of handlers covers
// both. Returns a `wasDragged()` getter so click handlers can ignore
// clicks that were actually the end of a drag gesture.
function initDragToScroll(wrap) {
  let isDown = false;
  let dragging = false;
  let startX = 0;
  let startScroll = 0;
  let dragged = false;

  wrap.addEventListener('pointerdown', (e) => {
    isDown = true;
    dragging = false;
    dragged = false;
    startX = e.clientX;
    startScroll = wrap.scrollLeft;
    // NOTE: no pointer capture yet. Capturing on pointerdown would
    // redirect the follow-up click to the wrapper and break clicking
    // the dots. We only capture once it's clearly a drag.
  });

  wrap.addEventListener('pointermove', (e) => {
    if (!isDown) return;
    const dx = e.clientX - startX;
    if (!dragging && Math.abs(dx) > 4) {
      dragging = true;
      dragged = true;
      wrap.setPointerCapture(e.pointerId);
      wrap.classList.add('is-dragging');
    }
    if (dragging) wrap.scrollLeft = startScroll - dx;
  });

  function stop() {
    isDown = false;
    dragging = false;
    wrap.classList.remove('is-dragging');
  }
  wrap.addEventListener('pointerup', stop);
  wrap.addEventListener('pointercancel', stop);

  // `dragged` stays true until the NEXT pointerdown, so a click event
  // that fires right after a drag ends can still see it and bail out.
  return () => dragged;
}

async function initTimeline() {
  const track = document.getElementById('timelineTrack');
  if (!track) return;

  const items = await resolveTimelineItems();
  if (items.length === 0) {
    track.parentElement.appendChild(makeEl('p', 'group__empty', 'Nothing on the timeline yet.'));
    return;
  }

  const wrap = track.parentElement;
  const wasDragged = initDragToScroll(wrap);

  const prevBtn = document.getElementById('timelinePrev');
  const nextBtn = document.getElementById('timelineNext');
  const selTitle = document.getElementById('timelineSelectedTitle');
  const selIndex = document.getElementById('timelineSelectedIndex');
  const tag = document.getElementById('timelineTag');
  const text = document.getElementById('timelineText');

  let current = 0;

  function select(i) {
    current = Math.max(0, Math.min(items.length - 1, i));
    const item = items[current];

    track.querySelectorAll('.tl-item').forEach((el) => {
      el.classList.toggle('is-selected', Number(el.dataset.index) === current);
    });

    fillOrPlaceholder(selTitle, item.title);
    selIndex.textContent = `[#${current + 1}]`;
    fillOrPlaceholder(tag, item.tag);
    fillOrPlaceholder(text, item.text);

    prevBtn.disabled = current === 0;
    nextBtn.disabled = current === items.length - 1;

    const el = track.querySelector(`.tl-item[data-index="${current}"]`);
    if (el) el.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }

  buildTrack(track, items, select, wasDragged);

  prevBtn.addEventListener('click', () => select(current - 1));
  nextBtn.addEventListener('click', () => select(current + 1));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') select(current - 1);
    if (e.key === 'ArrowRight') select(current + 1);
  });

  select(0);
}

document.addEventListener('DOMContentLoaded', initTimeline);
