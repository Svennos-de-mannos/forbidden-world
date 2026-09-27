// Generic loader for any card-type JSON file. Every page's own script
// (e.g. home-campaigns.js) calls this and then renders the results
// however that page needs to.
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

// Small helper: returns the given text, or marks the element as an
// empty placeholder ("???") when the field hasn't been filled in yet.
function fillOrPlaceholder(el, text) {
  if (text && text.trim() !== '') {
    el.textContent = text;
    el.classList.remove('placeholder');
  } else {
    el.textContent = '';
    el.classList.add('placeholder');
  }
}
