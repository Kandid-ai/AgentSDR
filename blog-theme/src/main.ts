/*
 * AgentSDR blog theme: progressive enhancement only. Every page renders and
 * navigates with this file blocked. Built by build.ts into assets/built/main.js.
 */

/** Numbered pagination: Ghost only exposes prev/next, so the number row is built from data-page / data-pages. */
function buildPagination(): void {
  const nav = document.querySelector<HTMLElement>("[data-pagination]");
  const slot = nav?.querySelector<HTMLElement>("[data-pagination-numbers]");
  if (!nav || !slot) return;
  const page = parseInt(nav.dataset.page ?? "", 10);
  const pages = parseInt(nav.dataset.pages ?? "", 10);
  if (!page || !pages || pages < 2) return;

  // Works for /blog/, /blog/tag/x/ and /blog/author/y/ alike.
  let base = window.location.pathname.replace(/\/page\/\d+\/?$/, "/");
  if (!base.endsWith("/")) base += "/";
  const href = (n: number) => (n === 1 ? base : `${base}page/${n}/`);

  // 1 … p-1 p p+1 … N
  const shown = [...new Set([1, pages, page, page - 1, page + 1].filter((n) => n >= 1 && n <= pages))].sort((a, b) => a - b);

  const frag = document.createDocumentFragment();
  let prev = 0;
  for (const n of shown) {
    if (prev && n - prev > 1) {
      const gap = document.createElement("span");
      gap.className = "pagination__gap";
      gap.textContent = "…";
      frag.appendChild(gap);
    }
    const current = n === page;
    const el = document.createElement(current ? "span" : "a");
    if (current) el.setAttribute("aria-current", "page");
    else (el as HTMLAnchorElement).href = href(n);
    el.className = `pagination__num${current ? " is-current" : ""}`;
    el.textContent = String(n);
    frag.appendChild(el);
    prev = n;
  }
  slot.textContent = "";
  slot.appendChild(frag);
}

/** Category rail active state, resolved from the path so every paginated variant stays correct. */
function markActiveTag(): void {
  const list = document.querySelector("[data-taglist]");
  if (!list) return;
  const current = window.location.pathname.match(/\/tag\/([^/]+)/)?.[1] ?? "";
  for (const item of list.querySelectorAll<HTMLElement>("[data-tag-slug]")) {
    if (item.dataset.tagSlug === current) {
      item.classList.add("is-active");
      if (current) item.setAttribute("aria-current", "page");
    }
  }
}

/** Header: white pill once scrolled, click-to-toggle mega-menus (touch), and the phone menu. */
function bindHeader(): void {
  const header = document.querySelector<HTMLElement>("[data-site-header]");
  if (!header) return;

  const onScroll = () => header.classList.toggle("is-scrolled", window.scrollY > 24);
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  const items = [...header.querySelectorAll<HTMLElement>("[data-nav-item]")];
  const closeAll = (except?: HTMLElement) => {
    for (const it of items) {
      if (it === except) continue;
      it.classList.remove("is-open");
      it.querySelector("[data-nav-trigger]")?.setAttribute("aria-expanded", "false");
    }
  };
  for (const it of items) {
    const trigger = it.querySelector<HTMLElement>("[data-nav-trigger]");
    trigger?.addEventListener("click", () => {
      const open = it.classList.toggle("is-open");
      trigger.setAttribute("aria-expanded", open ? "true" : "false");
      closeAll(it);
    });
  }
  document.addEventListener("click", (e) => {
    if (!(e.target instanceof Node) || !header.contains(e.target)) closeAll();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      closeAll();
      setMenu(false);
    }
  });

  const burger = header.querySelector<HTMLElement>("[data-nav-toggle]");
  const setMenu = (open: boolean) => {
    header.classList.toggle("is-menu-open", open);
    burger?.setAttribute("aria-expanded", open ? "true" : "false");
    document.documentElement.classList.toggle("menu-lock", open);
  };
  burger?.addEventListener("click", () => setMenu(!header.classList.contains("is-menu-open")));
}

function bindCopyLink(): void {
  const btn = document.querySelector<HTMLElement>("[data-copy-link]");
  if (!btn || !navigator.clipboard) return;
  btn.addEventListener("click", () => {
    void navigator.clipboard.writeText(btn.dataset.copyLink ?? "").then(() => {
      const label = btn.getAttribute("aria-label") ?? "";
      btn.setAttribute("aria-label", "Link copied");
      btn.classList.add("is-done");
      setTimeout(() => {
        btn.setAttribute("aria-label", label);
        btn.classList.remove("is-done");
      }, 2000);
    });
  });
}

/**
 * Table of contents from the article's h2s. Ghost already emits an id on every
 * heading; the fallback only covers imported content. Hidden below three
 * headings. Scroll-spy compares document coordinates, not IntersectionObserver,
 * so a heading stays current for its whole section.
 */
function buildToc(): void {
  const toc = document.querySelector<HTMLElement>("[data-toc]");
  const list = document.querySelector<HTMLElement>("[data-toc-list]");
  const content = document.querySelector<HTMLElement>("[data-content]");
  if (!toc || !list || !content) return;

  const heads = [...content.querySelectorAll<HTMLElement>("h2")];
  if (heads.length < 3) return;

  const items = heads.map((heading, i) => {
    if (!heading.id) heading.id = `section-${i + 1}`;
    const li = document.createElement("li");
    const link = document.createElement("a");
    link.className = "toc__link";
    link.href = `#${heading.id}`;
    link.textContent = heading.textContent;
    li.appendChild(link);
    list.appendChild(li);
    return { heading, link };
  });
  toc.hidden = false;

  let active: (typeof items)[number] | null = null;
  const spy = () => {
    const mark = window.scrollY + 140;
    let current = items[0];
    for (const item of items) {
      if (item.heading.getBoundingClientRect().top + window.scrollY <= mark) current = item;
      else break;
    }
    if (current === active) return;
    active?.link.classList.remove("is-active");
    current.link.classList.add("is-active");
    active = current;

    // Keep the active entry visible inside the list without scrolling the page.
    const lr = list.getBoundingClientRect();
    const ar = current.link.getBoundingClientRect();
    if (ar.top < lr.top) list.scrollTop -= lr.top - ar.top + 8;
    else if (ar.bottom > lr.bottom) list.scrollTop += ar.bottom - lr.bottom + 8;
  };

  let ticking = false;
  window.addEventListener(
    "scroll",
    () => {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(() => {
        spy();
        ticking = false;
      });
    },
    { passive: true },
  );
  spy();
}

function init(): void {
  buildPagination();
  buildToc();
  markActiveTag();
  bindHeader();
  bindCopyLink();
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
else init();
