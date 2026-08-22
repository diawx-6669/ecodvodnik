// Навигация по разделам: плавная прокрутка и подсветка активного пункта.

(function initSiteNav() {
  const nav = document.getElementById('site-nav');
  if (!nav) return;

  const links = Array.from(nav.querySelectorAll('.site-nav-link[data-nav-target]'));
  const sections = links
    .map((link) => document.getElementById(link.dataset.navTarget))
    .filter(Boolean);

  if (!sections.length) return;

  function setActiveLink(id) {
    links.forEach((link) => {
      link.classList.toggle('is-active', link.dataset.navTarget === id);
    });
  }

  links.forEach((link) => {
    link.addEventListener('click', (event) => {
      const target = document.getElementById(link.dataset.navTarget);
      if (!target) return;

      event.preventDefault();
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setActiveLink(link.dataset.navTarget);
      history.replaceState(null, '', `#${link.dataset.navTarget}`);
    });
  });

  const observer = new IntersectionObserver(
    (entries) => {
      const visible = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio);

      if (visible[0]) setActiveLink(visible[0].target.id);
    },
    {
      root: null,
      rootMargin: '-38% 0px -48% 0px',
      threshold: [0, 0.15, 0.35, 0.55],
    },
  );

  sections.forEach((section) => observer.observe(section));

  const hash = window.location.hash.replace('#', '');
  if (hash && document.getElementById(hash)) {
    requestAnimationFrame(() => {
      document.getElementById(hash).scrollIntoView({ behavior: 'smooth', block: 'start' });
      setActiveLink(hash);
    });
  } else if (sections[0]) {
    setActiveLink(sections[0].id);
  }
})();
