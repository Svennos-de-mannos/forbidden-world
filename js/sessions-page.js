// Builds the Session Recaps page from data/sessions.json.
//
// Layout: chronological list per campaign (sessions can be "0", "1",
// "1a", "2a", etc. — sorted numerically-then-alphabetically, not as
// plain strings), plus a separate One-shots section at the bottom for
// anything with oneShot: true.

function makeEl(tag, className, text) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text !== undefined) el.textContent = text;
  return el;
}

// "0" -> [0, ''], "1a" -> [1, 'a'], "12" -> [12, ''] — sorts sessions in
// the order they were actually played, not alphabetically (which would
// put "10" before "2").
function parseSessionNumber(raw) {
  const m = String(raw || '').match(/^(\d+)\s*([a-zA-Z]*)$/);
  return m ? [parseInt(m[1], 10), m[2]] : [Number.MAX_SAFE_INTEGER, String(raw || '')];
}

function compareSessions(a, b) {
  const [numA, letA] = parseSessionNumber(a.sessionNumber);
  const [numB, letB] = parseSessionNumber(b.sessionNumber);
  return numA - numB || letA.localeCompare(letB);
}

function buildSessionBar(session, ctx) {
  const accent = resolveColor(session.color, ctx.palette) ||
    (ctx.campaignById[session.campaign] && ctx.campaignById[session.campaign].colorMain);

  const bar = makeEl('button', 'session-bar');
  bar.type = 'button';
  bar.style.setProperty('--accent', accent);

  const number = session.oneShot ? 'One-shot' : `Session ${session.sessionNumber}`;
  bar.appendChild(makeEl('span', 'session-bar__number', number));
  const title = makeEl('span', 'session-bar__title');
  fillOrPlaceholder(title, session.title);
  bar.appendChild(title);

  bar.addEventListener('click', () => {
    const metaLabel = session.oneShot
      ? 'One-shot'
      : `Session ${session.sessionNumber} · ${ctx.campaignById[session.campaign] ? ctx.campaignById[session.campaign].title : ''}`;
    fillSessionPopup(session, { accent, metaLabel });
  });

  return bar;
}

async function renderSessionsPage() {
  const list = document.getElementById('sessionsList');
  if (!list) return;

  const [campaigns, sessions, palette] = await Promise.all([
    loadCards('data/campaigns.json'),
    loadCards('data/sessions.json'),
    loadPalette(),
  ]);
  const campaignById = Object.fromEntries(campaigns.map((c) => [c.id, c]));
  const ctx = { campaignById, palette };

  const oneShots = sessions.filter((s) => s.oneShot);

  campaigns.forEach((campaign) => {
    const forCampaign = sessions
      .filter((s) => !s.oneShot && s.campaign === campaign.id)
      .sort(compareSessions);

    const section = makeEl('section', 'session-campaign');
    const heading = makeEl('h2', 'section-title', campaign.title);
    heading.style.setProperty('--accent', campaign.colorMain);
    section.appendChild(heading);

    if (forCampaign.length === 0) {
      section.appendChild(makeEl('p', 'group__empty', 'No sessions yet'));
    } else {
      forCampaign.forEach((s) => section.appendChild(buildSessionBar(s, ctx)));
    }
    list.appendChild(section);
  });

  const oneShotSection = makeEl('section', 'session-campaign');
  oneShotSection.appendChild(makeEl('h2', 'section-title', 'One-shots'));
  if (oneShots.length === 0) {
    oneShotSection.appendChild(makeEl('p', 'group__empty', 'No one-shots yet'));
  } else {
    oneShots.forEach((s) => oneShotSection.appendChild(buildSessionBar(s, ctx)));
  }
  list.appendChild(oneShotSection);
}

document.addEventListener('DOMContentLoaded', renderSessionsPage);
