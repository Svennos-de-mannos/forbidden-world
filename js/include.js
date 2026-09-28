// Loads shared HTML partials into every page, so the nav/footer/popups
// only need to be edited in one place. Any element written as
//   <div data-include="footer"></div>
// is filled with partials/footer.html — so adding a new partial (a new
// popup type, say) never requires touching this file.
//
// Requires the page to be served over http(s) — fetch() of local files
// needs a dev server, it won't work opened directly via file://.

async function loadPartial(url, target) {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${url} responded ${res.status}`);
    target.innerHTML = await res.text();
  } catch (err) {
    console.error(`Could not load ${url}`, err);
  }
}

function buildNavLists() {
  const currentPage = document.body.dataset.page;
  document.querySelectorAll('[data-nav-list]').forEach((list) => {
    const isSidebar = list.closest('.sidebar') !== null;
    list.innerHTML = NAV_LINKS.map(({ label, page, href }) => {
      const activeClass = page === currentPage ? ' is-active' : '';
      const linkClass = isSidebar ? 'sidebar__link' : 'nav-panel__link';
      return `<li><a class="${linkClass}${activeClass}" href="${href}">${label}</a></li>`;
    }).join('');
  });
}

function initHamburger() {
  const toggle = document.getElementById('burgerToggle');
  const panel = document.getElementById('navPanel');
  if (!toggle || !panel) return;
  toggle.addEventListener('click', () => {
    const isOpen = panel.classList.toggle('is-open');
    toggle.setAttribute('aria-expanded', String(isOpen));
  });
}

document.addEventListener('DOMContentLoaded', async () => {
  const slots = document.querySelectorAll('[data-include]');
  await Promise.all(
    [...slots].map((slot) => loadPartial(`partials/${slot.dataset.include}.html`, slot))
  );
  buildNavLists();
  initHamburger();
  if (typeof initPopup === 'function') initPopup();
});
