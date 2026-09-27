// Loads shared HTML partials (header, footer) into every page, so the
// nav/footer only need to be edited in one place. Requires the page to
// be served over http(s) — fetch() of local files needs a dev server
// (see README), it won't work opened directly via file://.

async function loadPartial(url, targetSelector) {
  const target = document.querySelector(targetSelector);
  if (!target) return;
  try {
    const res = await fetch(url);
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
  await Promise.all([
    loadPartial('partials/header.html', '[data-include="header"]'),
    loadPartial('partials/footer.html', '[data-include="footer"]'),
    loadPartial('partials/popup-campaign.html', '[data-include="popup-campaign"]'),
  ]);
  buildNavLists();
  initHamburger();
  if (typeof initPopup === 'function') initPopup();
});