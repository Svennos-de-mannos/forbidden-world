// Generic loader for any card-type JSON file. Every page's own script
// (e.g. npcs-page.js) calls this and then renders the results however
// that page needs to.
async function loadCards(path) {
  try {
    const res = await fetch(path);
    if (!res.ok) throw new Error(`${path} responded ${res.status}`);
    return await res.json();
  } catch (err) {
    console.error(`Could not load ${path}`, err);
    return [];
  }
}

// Escapes raw text so it's always safe to drop into innerHTML — every
// field goes through this before anything else touches it.
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// The one bit of markup card text supports: wrap a word or phrase in
// **double asterisks** in your JSON and it renders in the brighter
// off-white color instead of the normal dimmed text color. Nothing else
// (no italics, no links) — just this one "whitening" effect.
// Runs AFTER escapeHtml, so the markup itself can't be used to inject
// real HTML.
function applyCardMarkup(escapedStr) {
  return escapedStr.replace(/\*\*([\s\S]+?)\*\*/g, '<span class="bright">$1</span>');
}

function formatCardText(raw) {
  return applyCardMarkup(escapeHtml(raw));
}

// Fills an element with a card field's text (supporting the **bright**
// markup above), or marks it as an empty "???" placeholder if the field
// hasn't been filled in yet.
function fillOrPlaceholder(el, text) {
  if (text && String(text).trim() !== '') {
    el.innerHTML = formatCardText(text);
    el.classList.remove('placeholder');
  } else {
    el.textContent = '';
    el.classList.add('placeholder');
  }
}
