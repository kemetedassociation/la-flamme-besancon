/* ==========================================================================
   LA FLAMME — Motion & interaction layer
   --------------------------------------------------------------------------
   Shared across all 3 pages (index.html, menu.html, bons-plans.html) — every
   init function guards on the DOM it needs and no-ops otherwise, so one file
   works everywhere without per-page branching.

   Architecture (mirrors the tokens defined in style.css):

   1. Reduced motion gate      — a single source of truth read once, used to
                                  bypass every JS-driven animation (the FLIP
                                  transition, the hero choreography timing,
                                  the cart-add pulse).

   2. Hero entrance             — index.html only: eyebrow → title →
                                  subtitle → actions → badges → image.

   3. Nav                      — solidifies on scroll; active link now
                                  reflects the current PAGE (multipage site)
                                  with an in-page scroll-spy override for
                                  #infos on the homepage. Sliding indicator
                                  reuses the tabs' mechanism (§4).

   4. Tabs                     — menu.html only: sliding pill indicator.

   5. Scroll reveal            — IntersectionObserver-driven, one-shot.

   6. Card → Detail FLIP       — clicked card grows into a detail panel at
                                  its own position; panel now also carries a
                                  real "Ajouter au panier" action (§9).

   7. Hero scroll depth         — index.html only, desktop/pointer only.

   8. Ken Burns (infos photo)  — index.html only, runs while in view.

   9. Cart                     — localStorage-backed, shared across pages by
                                  same-origin storage. Finalizes via a
                                  prefilled WhatsApp / email message (no
                                  payment processor — see chat for why).

   10. Custom cursor            — desktop/fine-pointer only, off under
                                  reduced-motion and on touch.

   11. Infinite carousel        — bestsellers strip on the homepage; a real
                                  scrollable list under reduced-motion/touch
                                  rather than an animated one (§15.6/§15.7).
   ========================================================================== */

(() => {
  "use strict";

  /* ---- 1. Reduced motion ------------------------------------------------ */
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const MS = prefersReducedMotion
    ? { micro: 1, ui: 1, narrative: 1 }
    : { micro: 180, ui: 420, narrative: 620 };

  const EASE_OUT = "cubic-bezier(.16,1,.3,1)";
  const IMG_BASE = "assets/img/";

  /* ---- 2. Hero entrance -------------------------------------------------- */
  function playHeroEntrance() {
    const hero = document.querySelector(".hero");
    if (!hero) return;
    requestAnimationFrame(() => requestAnimationFrame(() => {
      hero.setAttribute("data-hero-play", "");
    }));
  }

  /* ---- 3. Nav ------------------------------------------------------------ */
  function initNav() {
    const nav = document.getElementById("nav");
    const burgerBtn = document.getElementById("burgerBtn");
    const mobileMenu = document.getElementById("mobileMenu");
    if (!nav) return;

    const onScroll = () => {
      nav.dataset.state = window.scrollY > 40 ? "scrolled" : "top";
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });

    if (burgerBtn && mobileMenu) {
      burgerBtn.addEventListener("click", () => {
        const isOpen = mobileMenu.classList.toggle("is-open");
        burgerBtn.setAttribute("aria-expanded", String(isOpen));
        mobileMenu.setAttribute("aria-hidden", String(!isOpen));
        document.body.classList.toggle("detail-open", isOpen);
      });
      mobileMenu.querySelectorAll("a").forEach((a) => a.addEventListener("click", () => {
        mobileMenu.classList.remove("is-open");
        burgerBtn.setAttribute("aria-expanded", "false");
        mobileMenu.setAttribute("aria-hidden", "true");
        document.body.classList.remove("detail-open");
      }));
    }

    const desktopLinks = Array.from(document.querySelectorAll(".nav__links [data-nav-link]"));
    const allLinks = Array.from(document.querySelectorAll("[data-nav-link]"));
    const navIndicator = document.querySelector(".nav__indicator");

    const moveNavIndicator = (link) => {
      if (!navIndicator || !link) return;
      navIndicator.style.width = link.offsetWidth + "px";
      navIndicator.style.transform = `translateX(${link.offsetLeft}px)`;
      navIndicator.classList.add("is-visible");
    };

    const setActiveHref = (href) => {
      allLinks.forEach((l) => l.classList.toggle("is-active", l.getAttribute("href") === href));
      const activeDesktopLink = desktopLinks.find((l) => l.classList.contains("is-active"));
      if (activeDesktopLink) moveNavIndicator(activeDesktopLink);
    };

    // Active link = current document (multipage), matched by filename.
    // Only a hash-free link (a plain page link, e.g. "menu.html") can be
    // this default — "index.html#infos" is deliberately excluded so the
    // homepage starts with nothing highlighted until scroll-spy below
    // decides #infos is actually in view.
    const currentFile = location.pathname.split("/").pop() || "index.html";
    const defaultLink = allLinks.find((l) => {
      const href = l.getAttribute("href") || "";
      if (href.includes("#")) return false;
      return (href || "index.html") === currentFile;
    });
    if (defaultLink) setActiveHref(defaultLink.getAttribute("href"));

    // Homepage only: scroll-spy #infos so the indicator follows it while
    // it's in view, same behaviour the single-page version had. Leaving
    // the section clears the highlight entirely (there's no page-level
    // link to fall back to on the homepage — home is the logo).
    const infosSection = document.getElementById("infos");
    if (infosSection && "IntersectionObserver" in window) {
      const io = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          setActiveHref(entry.isIntersecting ? "index.html#infos" : (defaultLink ? defaultLink.getAttribute("href") : ""));
        });
      }, { rootMargin: "-45% 0px -45% 0px" });
      io.observe(infosSection);
    }

    window.addEventListener("resize", () => {
      const activeDesktopLink = desktopLinks.find((l) => l.classList.contains("is-active"));
      if (activeDesktopLink) moveNavIndicator(activeDesktopLink);
    });
  }

  /* ---- 4. Tabs ------------------------------------------------------------ */
  function initTabs() {
    const tabs = document.getElementById("tabs");
    if (!tabs) return;
    const buttons = Array.from(tabs.querySelectorAll(".tabs__btn"));
    const indicator = tabs.querySelector(".tabs__indicator");
    const panels = Array.from(document.querySelectorAll(".tab-panel"));

    const moveIndicator = (btn) => {
      // width/height/position all read directly from the button — see the
      // .tabs__indicator comment in style.css for why (multi-row wrap).
      indicator.style.width = btn.offsetWidth + "px";
      indicator.style.height = btn.offsetHeight + "px";
      indicator.style.transform = `translate(${btn.offsetLeft}px, ${btn.offsetTop}px)`;
    };

    const activate = (btn) => {
      buttons.forEach((b) => { b.classList.remove("is-active"); b.setAttribute("aria-selected", "false"); });
      btn.classList.add("is-active");
      btn.setAttribute("aria-selected", "true");
      moveIndicator(btn);

      const target = btn.dataset.tab;
      panels.forEach((p) => {
        const show = p.dataset.panel === target;
        p.hidden = !show;
        p.classList.toggle("is-active", show);
        // Content revealed by switching tabs (e.g. the Desserts card grid)
        // is already relevant the moment it's shown — it shouldn't wait for
        // an IntersectionObserver that never fired while [hidden] gave it
        // no geometry to observe. Reveal it immediately instead.
        if (show) {
          p.querySelectorAll(".reveal, .reveal-child").forEach((el) => el.classList.add("is-visible"));
        }
      });
    };

    buttons.forEach((btn) => btn.addEventListener("click", () => activate(btn)));

    // Deep-link support: menu.html#pizzas activates the Pizzas tab on load
    // (used by the homepage's category shortcuts).
    const hashTarget = location.hash.replace("#", "");
    const hashBtn = hashTarget && buttons.find((b) => b.dataset.tab === hashTarget);
    if (hashBtn) activate(hashBtn);

    const initial = tabs.querySelector(".tabs__btn.is-active") || buttons[0];
    requestAnimationFrame(() => moveIndicator(initial));
    window.addEventListener("resize", () => {
      const current = tabs.querySelector(".tabs__btn.is-active");
      if (current) moveIndicator(current);
    });
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(() => moveIndicator(tabs.querySelector(".tabs__btn.is-active")));
    }
  }

  /* ---- 5. Scroll reveal ---------------------------------------------------- */
  function initReveal() {
    const items = Array.from(document.querySelectorAll(".reveal"));
    if (!items.length) return;

    if (prefersReducedMotion || !("IntersectionObserver" in window)) {
      items.forEach((el) => el.classList.add("is-visible"));
      document.querySelectorAll(".reveal-child").forEach((el) => el.classList.add("is-visible"));
      return;
    }

    const io = new IntersectionObserver((entries, obs) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-visible");
        entry.target.querySelectorAll(".reveal-child").forEach((el) => el.classList.add("is-visible"));
        obs.unobserve(entry.target);
      });
    }, { threshold: 0.15, rootMargin: "0px 0px -8% 0px" });

    items.forEach((el) => io.observe(el));
  }

  /* ---- 7. Hero scroll depth ----------------------------------------------- */
  function initHeroScrollDepth() {
    if (prefersReducedMotion) return;
    if (window.matchMedia("(max-width: 768px), (hover: none)").matches) return;

    const hero = document.querySelector(".hero");
    const frame = document.querySelector(".hero__visual-frame");
    if (!hero || !frame) return;

    let ticking = false;
    const update = () => {
      const heroHeight = hero.offsetHeight || window.innerHeight;
      const t = Math.min(1, Math.max(0, window.scrollY / heroHeight));
      frame.style.transform = `translateY(${(t * -26).toFixed(1)}px) scale(${(1 - t * 0.05).toFixed(3)})`;
      ticking = false;
    };
    window.addEventListener("scroll", () => {
      if (!ticking) { requestAnimationFrame(update); ticking = true; }
    }, { passive: true });
    update();
  }

  /* ---- 8. Ken Burns — infos photo, only while visible --------------------- */
  function initKenBurns() {
    const img = document.querySelector(".infos__photo img");
    if (!img || prefersReducedMotion || !("IntersectionObserver" in window)) return;

    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => img.classList.toggle("is-in-view", entry.isIntersecting));
    }, { threshold: 0.2 });
    io.observe(img);
  }

  /* ==========================================================================
     MENU DATA — single source of truth for cards, the tabbed menu, the
     bons-plans page and the cart. Every price here is a display string
     ("8,50€"); parsePrice() below converts to a number for cart math, so
     there's never two copies of a price to keep in sync.
     ========================================================================== */
  const BESTSELLERS = [
    { id: "assiette", name: "Assiette Kebab", price: "13,90€", img: "assiette.jpg",
      desc: "Viande au choix (kebab, poulet, steak, merguez, tenders ou cordon bleu), accompagnée de frites maison, salade et riz." },
    { id: "double-smash", name: "Double Smash", price: "8,90€", img: "double_smash.jpg",
      desc: "Potato bun, deux steaks frais smashés, cheddar, œuf, crudités et sauce spéciale de la maison." },
    { id: "chabago", name: "Chabago", price: "9€", img: "chabago_sandwich.jpg",
      desc: "Pain maison, poulet, boursin, jambon, olives, cheddar, crudités et sauce au choix." },
    { id: "mixte", name: "Sandwich MIXTE", price: "9,50€", img: "mixte_sandwich.jpg",
      desc: "Pain maison, deux viandes au choix, cheddar, crudités et sauce au choix." },
    { id: "crb", name: "Burger C.R.B", price: "8,90€", img: "crb_burger.jpg",
      desc: "Pain bioché, poulet pané, rösti, bacon, cheddar, crudités et sauce au choix." },
    { id: "raclette", name: "Burger Raclette", price: "6,90€", img: "raclette_burger.jpg",
      desc: "Pain bioché, steak frais, cheddar, raclette fondante, crudités et sauce au choix." },
    { id: "poulet-marine", name: "Poulet Mariné", price: "8,50€", img: "poulet_marine_sandwich.jpg",
      desc: "Pain maison, poulet mariné, cheddar, crudités et sauce au choix." },
    { id: "double-cheese", name: "Double Cheese", price: "8€", img: "double_cheese_burger.jpg",
      desc: "Pain brioché, deux steaks frais, cheddar, crudités et sauce au choix." },
    { id: "tacos-xl", name: "Tacos XL", price: "12,50€", img: "tacos_xl.jpg",
      desc: "3 viandes au choix (tenders, nuggets, cordon bleu, poulet crème, poulet mariné, steak, merguez, kebab) et sauce fromagère maison." },
    { id: "pizza-laflamme", name: "Pizza La Flamme", price: "12,50€", img: "pizza_laflamme.jpg",
      desc: "Viande hachée, merguez, poivrons, oignon, champignons — pâte fraîche maison, base tomate." },
    { id: "poulet-creme", name: "Poulet Crème", price: "8,50€", img: "poulet_creme_sandwich.jpg",
      desc: "Pain maison, poulet crème, cheddar, crudités et sauce au choix." },
    { id: "sbo", name: "Sandwich S.B.O", price: "9€", img: "sbo_sandwich.jpg",
      desc: "Pain maison, steak, bacon, œuf, cheddar, crudités et sauce au choix." },
    { id: "chevre-miel", name: "Burger Chèvre Miel", price: "6,90€", img: "chevre_miel_burger.jpg",
      desc: "Pain bioché, steak frais, chèvre fondant, miel, crudités et sauce au choix." },
    { id: "laflamme-sandwich", name: "Sandwich La Flamme", price: "10,50€", img: "laflamme_sandwich.jpg",
      desc: "Pain maison, poulet mariné et steak, cheddar et raclette, lardons, crudités et sauce au choix." },
  ];

  const DESSERTS = [
    { id: "milkshake", name: "Milkshake", price: "3,50€", img: "milkshake_trio.jpg",
      desc: "Chocolat, fraise ou vanille. Topping +1€ (KitKat, spéculos, oreo) · Coulis +0,50€ (chocolat, caramel, fraise)." },
    { id: "smoothie", name: "Smoothie", price: "3,50€", img: "smoothie_trio.jpg",
      desc: "Fraise, ou mangue &amp; ananas — pressé frais." },
    { id: "tiramisu", name: "Tiramisu Maison", price: "4€", img: "tiramisu.jpg",
      desc: "Recette maison, classique ou façon cookie." },
    { id: "cheesecake", name: "Cheesecake", price: "4€", img: "cheesecake.jpg",
      desc: "Base biscuitée, crème onctueuse, glaçage caramel." },
    { id: "fruits", name: "Salade de Fruits", price: "3,50€", img: "fruit_salad.jpg",
      desc: "Fraîche et généreuse, préparée du jour." },
  ];

  const BONSPLANS = [
    { id: "bp-flambox", name: "FLAM'BOX", price: "7,50€", img: "flambox.jpg",
      desc: "Frites maison, emmental fondu, sauce et viande au choix (tenders, cordon bleu, kebab, poulet mariné). La petite fringale qui cale." },
    { id: "bp-crousty", name: "Crousty'Flam + boisson", price: "10€", img: "crousty.jpg",
      desc: "Poulet croustillant, riz, sauce sucrée et/ou piquante — servi avec une boisson incluse." },
    { id: "bp-texmex", name: "Tex Mex à partager", price: "7,50€", img: "tex_tenders.jpg",
      desc: "Tenders, nuggets, wings ou mozza sticks, à partir de 6 pièces — idéal à plusieurs. Choisissez votre format sur la carte." },
  ];

  // Full tabbed menu — rendered into menu.html's empty panels by renderMenu().
  const MENU = {
    tacos: [
      { id: "tacos-m", name: "Tacos M", meta: "1 viande", price: "8,50€" },
      { id: "tacos-l", name: "Tacos L", meta: "2 viandes", price: "10,50€" },
      { id: "tacos-xl", name: "Tacos XL", meta: "3 viandes", price: "12,50€" },
    ],
    pizzas: [
      { id: "pizza-margarita", name: "Margarita", meta: "sauce tomate, mozzarella", price: "12,50€", group: "tomate" },
      { id: "pizza-vegetarien", name: "Végétarien", meta: "champignon, artichaut, poivron, oignon, olive", price: "12,50€", group: "tomate" },
      { id: "pizza-4fromages", name: "4 Fromages", meta: "mozzarella, chèvre, gorgonzola, bleu", price: "12,50€", group: "tomate" },
      { id: "pizza-oriental", name: "Oriental", meta: "merguez, poivron, oignon, olive, œuf", price: "12,50€", group: "tomate" },
      { id: "pizza-campione", name: "Campione", meta: "viande hachée, champignons", price: "12,50€", group: "tomate" },
      { id: "pizza-cannibal", name: "Cannibal", meta: "viande hachée, merguez, poulet", price: "12,50€", group: "tomate" },
      { id: "pizza-kebab", name: "Kebab", meta: "kebab, tomate fraîche, oignon", price: "12,50€", group: "tomate" },
      { id: "pizza-calzone", name: "Calzone", meta: "jambon, œuf", price: "12,50€", group: "tomate" },
      { id: "pizza-3jambon", name: "3 Jambon", meta: "lardons, chorizo, jambon", price: "12,50€", group: "tomate" },
      { id: "pizza-thon", name: "Thon", meta: "poivron, oignon, olive", price: "12,50€", group: "tomate" },
      { id: "pizza-reine", name: "Reine", meta: "jambon, champignons", price: "12,50€", group: "tomate" },
      { id: "pizza-fruitsdemer", name: "Fruits de mer", meta: "", price: "12,50€", group: "tomate" },
      { id: "pizza-pepperoni", name: "Pepperoni", meta: "", price: "12,50€", group: "tomate" },
      { id: "pizza-anchois", name: "Anchois", meta: "", price: "12,50€", group: "tomate" },
      { id: "pizza-laflamme", name: "La Flamme", meta: "viande hachée, merguez, poivrons, oignon, champignons", price: "12,50€", group: "tomate" },
      { id: "pizza-chevremiel", name: "Chèvre Miel", meta: "", price: "12,50€", group: "creme" },
      { id: "pizza-poulet", name: "Poulet", meta: "", price: "12,50€", group: "creme" },
      { id: "pizza-tartiflette", name: "Tartiflette", meta: "lardons, reblochon, pomme de terre", price: "12,50€", group: "creme" },
      { id: "pizza-boursin", name: "Boursin", meta: "viande hachée, pomme de terre", price: "12,50€", group: "creme" },
      { id: "pizza-raclette", name: "Raclette", meta: "jambon, pomme de terre", price: "12,50€", group: "creme" },
      { id: "pizza-saumon", name: "Saumon", meta: "", price: "12,50€", group: "creme" },
      { id: "pizza-cremiere", name: "Crémière", meta: "jambon", price: "12,50€", group: "creme" },
    ],
    sandwichs: [
      { id: "sw-pouletcreme", name: "Poulet crème", meta: "", price: "8,50€" },
      { id: "sw-americain", name: "Américain", meta: "steak, cheddar, crudités", price: "8,50€" },
      { id: "sw-pouletmarine", name: "Poulet mariné", meta: "", price: "8,50€" },
      { id: "sw-chabago", name: "Chabago", meta: "poulet, boursin, jambon, olives", price: "9€" },
      { id: "sw-sbo", name: "S.B.O", meta: "steak, bacon, œuf", price: "9€" },
      { id: "sw-mixte", name: "MIXTE", meta: "2 viandes au choix", price: "9,50€" },
      { id: "sw-laflamme", name: "La Flamme", meta: "poulet mariné + steak, cheddar + raclette, lardons", price: "10,50€" },
    ],
    burgers: [
      { id: "bg-cheese", name: "Cheese", meta: "", price: "6€" },
      { id: "bg-chicken", name: "Chicken", meta: "poulet pané", price: "6,90€" },
      { id: "bg-raclette", name: "Raclette", meta: "", price: "6,90€" },
      { id: "bg-chevremiel", name: "Chèvre Miel", meta: "", price: "6,90€" },
      { id: "bg-doublecheese", name: "Double Cheese", meta: "2 steaks frais", price: "8€" },
      { id: "bg-crb", name: "C.R.B", meta: "poulet pané, rösti, bacon", price: "8,90€" },
      { id: "bg-doublesmash", name: "Double Smash", meta: "potato bun, 2 steaks, œuf", price: "8,90€" },
    ],
    plats: [
      { id: "plat-assiette", name: "Assiette", meta: "viande au choix, frites maison, salade et riz", price: "13,90€" },
      { id: "plat-flambox", name: "FLAM'BOX", meta: "frites, emmental, sauce, viande au choix", price: "7,50€" },
      { id: "plat-crousty", name: "Crousty'Flam", meta: "+ boisson · sauce sucrée / piquante", price: "10€" },
    ],
    boissons: [
      { id: "boisson-eau", name: "Eau", meta: "", price: "1€" },
      { id: "boisson-canette", name: "Canette", meta: "", price: "2€" },
      { id: "boisson-redbull", name: "RedBull", meta: "", price: "3€" },
    ],
  };

  const TEXMEX = [
    { name: "Tenders", img: "tex_tenders.jpg", sizes: [["x6", "7,50€"], ["x8", "10€"], ["x10", "12,50€"], ["x12", "15€"]] },
    { name: "Nuggets", img: "", sizes: [["x6", "6€"], ["x8", "8€"], ["x10", "10€"], ["x12", "12€"]] },
    { name: "Wings", img: "tex_wings.jpg", sizes: [["x6", "6€"], ["x8", "8€"], ["x10", "10€"], ["x12", "12€"]] },
    { name: "Mozza Sticks", img: "tex_mozza.jpg", sizes: [["x6", "6€"], ["x8", "8€"], ["x10", "10€"], ["x12", "12€"]] },
  ];

  function parsePrice(label) {
    return parseFloat(String(label).replace(",", ".").replace(/[^0-9.]/g, "")) || 0;
  }
  function formatPrice(n) {
    return n.toFixed(2).replace(".", ",").replace(",00", "") + "€";
  }

  function addBtn(item, label) {
    return `<button type="button" class="add-btn" data-add-item
        data-id="${item.id}" data-name="${(item.name).replace(/"/g, "&quot;")}"
        data-price="${item.price}" data-img="${item.img || ""}">${label || "Ajouter"}</button>`;
  }

  function cardTemplate(item) {
    return `
      <article class="card" data-id="${item.id}" tabindex="0" role="button" aria-haspopup="dialog">
        <div class="card__media">
          <img src="${IMG_BASE}${item.img}" alt="${item.name}" loading="lazy">
          <span class="card__price">${item.price}</span>
        </div>
        <div class="card__body">
          <h3 class="card__name">${item.name}</h3>
          <p class="card__desc">${item.desc}</p>
          <span class="card__view">Voir le détail
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
          </span>
        </div>
        <div class="card__foot">${addBtn(item, "Ajouter · " + item.price).replace('class="add-btn"', 'class="add-btn card__add"')}</div>
      </article>`;
  }

  function renderCards() {
    const bestGrid = document.getElementById("bestGrid");
    const dessertGrid = document.getElementById("dessertGrid");
    const bonsPlansGrid = document.getElementById("bonsPlansGrid");
    if (bestGrid) bestGrid.innerHTML = BESTSELLERS.map(cardTemplate).join("");
    if (dessertGrid) dessertGrid.innerHTML = DESSERTS.map(cardTemplate).join("");
    if (bonsPlansGrid) bonsPlansGrid.innerHTML = BONSPLANS.map(cardTemplate).join("");

    [bestGrid, dessertGrid, bonsPlansGrid].forEach((grid) => {
      if (!grid) return;
      Array.from(grid.children).forEach((card, i) => {
        card.classList.add("reveal-child");
        card.style.transitionDelay = Math.min(i * 60, 420) + "ms";
      });
    });
  }

  function menuRowTemplate(item) {
    return `
      <div class="menu-list__row">
        <div class="menu-list__row-info">
          <span class="menu-list__name">${item.name}${item.meta ? ` <em>· ${item.meta}</em>` : ""}</span>
        </div>
        <div class="menu-list__row-end">
          <span class="menu-list__price">${item.price}</span>
          ${addBtn(item)}
        </div>
      </div>`;
  }

  function pizzaTemplate(items, group) {
    return items.filter((p) => p.group === group).map((p) => `
      <div class="menu-list__row">
        <div class="menu-list__row-info">
          <span class="menu-list__name">${p.name}${p.meta ? ` <em>· ${p.meta}</em>` : ""}</span>
        </div>
        <div class="menu-list__row-end">
          ${addBtn(p, "Ajouter")}
        </div>
      </div>`).join("");
  }

  // Size picker (Tex Mex): a segmented control (sliding pill, same mechanism
  // as the tabs) instead of 4 always-visible buttons — pick a size, the
  // price updates with a quick dip+fade, and the single "Ajouter" button
  // always adds exactly the size currently selected.
  function texMexTemplate() {
    return TEXMEX.map((product, pi) => {
      const first = product.sizes[0];
      const slug = product.name.toLowerCase().replace(/\s+/g, "");
      return `
      <div class="sizepicker" data-product="${slug}">
        ${product.img ? `<div class="sizepicker__media"><img src="${IMG_BASE}${product.img}" alt="${product.name}" loading="lazy"></div>` : ""}
        <div class="sizepicker__body">
          <span class="sizepicker__name">${product.name}</span>
          <div class="sizepicker__sizes">
            ${product.sizes.map(([size, price], i) => `
              <button type="button" class="sizepicker__size${i === 0 ? " is-active" : ""}"
                  data-size="${size}" data-price="${price}">${size}</button>`).join("")}
            <span class="sizepicker__pill" aria-hidden="true"></span>
          </div>
          <div class="sizepicker__footer">
            <span class="sizepicker__price" data-price-display>${first[1]}</span>
            ${addBtn({ id: `tm-${slug}-${first[0]}`, name: `${product.name} ${first[0]}`, price: first[1] })}
          </div>
        </div>
      </div>`;
    }).join("");
  }

  function initSizePickers() {
    document.querySelectorAll(".sizepicker").forEach((picker) => {
      const sizesEl = picker.querySelector(".sizepicker__sizes");
      const pill = picker.querySelector(".sizepicker__pill");
      const priceEl = picker.querySelector(".sizepicker__price");
      const addBtnEl = picker.querySelector("[data-add-item]");
      const buttons = Array.from(picker.querySelectorAll(".sizepicker__size"));
      const productName = picker.querySelector(".sizepicker__name").textContent;
      const slug = picker.dataset.product;

      const movePill = (btn) => {
        pill.style.width = btn.offsetWidth + "px";
        pill.style.transform = `translateX(${btn.offsetLeft - 4}px)`;
      };

      const select = (btn) => {
        buttons.forEach((b) => b.classList.remove("is-active"));
        btn.classList.add("is-active");
        movePill(btn);

        const size = btn.dataset.size;
        const price = btn.dataset.price;
        addBtnEl.dataset.id = `tm-${slug}-${size}`;
        addBtnEl.dataset.name = `${productName} ${size}`;
        addBtnEl.dataset.price = price;

        if (prefersReducedMotion) {
          priceEl.textContent = price;
          return;
        }
        priceEl.classList.add("is-updating");
        window.setTimeout(() => {
          priceEl.textContent = price;
          priceEl.classList.remove("is-updating");
        }, MS.micro);
      };

      buttons.forEach((btn) => btn.addEventListener("click", () => select(btn)));
      requestAnimationFrame(() => movePill(buttons[0]));
      window.addEventListener("resize", () => {
        const active = picker.querySelector(".sizepicker__size.is-active");
        if (active) movePill(active);
      });
    });
  }

  function renderMenu() {
    const tacosEl = document.getElementById("panel-tacos-list");
    const pizzaTomateEl = document.getElementById("panel-pizza-tomate");
    const pizzaCremeEl = document.getElementById("panel-pizza-creme");
    const sandwichsEl = document.getElementById("panel-sandwichs-list");
    const burgersEl = document.getElementById("panel-burgers-list");
    const platsEl = document.getElementById("panel-plats-list");
    const texmexEl = document.getElementById("panel-texmex-list");
    const boissonsEl = document.getElementById("panel-boissons-list");

    if (tacosEl) tacosEl.innerHTML = MENU.tacos.map(menuRowTemplate).join("");
    if (pizzaTomateEl) pizzaTomateEl.innerHTML = pizzaTemplate(MENU.pizzas, "tomate");
    if (pizzaCremeEl) pizzaCremeEl.innerHTML = pizzaTemplate(MENU.pizzas, "creme");
    if (sandwichsEl) sandwichsEl.innerHTML = MENU.sandwichs.map(menuRowTemplate).join("");
    if (burgersEl) burgersEl.innerHTML = MENU.burgers.map(menuRowTemplate).join("");
    if (platsEl) platsEl.innerHTML = MENU.plats.map(menuRowTemplate).join("");
    if (texmexEl) texmexEl.innerHTML = texMexTemplate();
    if (boissonsEl) boissonsEl.innerHTML = MENU.boissons.map(menuRowTemplate).join("");
  }

  /* ---- 11. Infinite carousel — bestsellers strip (home) -------------------- */
  function renderCarousel() {
    const track = document.getElementById("carouselTrack");
    if (!track) return;
    const html = BESTSELLERS.map(cardTemplate).join("");
    track.innerHTML = html + html; // duplicated once = seamless loop point at -50%
  }

  /* ---- 6. Card → Detail FLIP transition ----------------------------------- */
  function initDetailOverlay() {
    const detail = document.getElementById("detail");
    const scrim = document.getElementById("detailScrim");
    const panel = document.getElementById("detailPanel");
    const closeBtn = document.getElementById("detailClose");
    const imgEl = document.getElementById("detailImg");
    const eyebrowEl = document.getElementById("detailEyebrow");
    const titleEl = document.getElementById("detailTitle");
    const descEl = document.getElementById("detailDesc");
    const priceEl = document.getElementById("detailPrice");
    const ctaEl = document.getElementById("detailCta");
    if (!detail || !panel) return;

    const ALL = [
      ...BESTSELLERS.map((i) => ({ ...i, eyebrow: "Best-seller" })),
      ...DESSERTS.map((i) => ({ ...i, eyebrow: "Dessert" })),
      ...BONSPLANS.map((i) => ({ ...i, eyebrow: "Bon plan" })),
    ];

    let originCard = null;
    let isAnimating = false;

    function transformFor(rect, w, h) {
      const sx = rect.width / w;
      const sy = rect.height / h;
      return `translate(${rect.left}px, ${rect.top}px) scale(${sx}, ${sy})`;
    }
    function restTransform(w, h) {
      const x = window.innerWidth / 2 - w / 2;
      const y = window.innerHeight / 2 - h / 2;
      return `translate(${x}px, ${y}px) scale(1, 1)`;
    }

    function open(item, card) {
      if (isAnimating) return;
      isAnimating = true;
      originCard = card;

      imgEl.src = IMG_BASE + item.img;
      imgEl.alt = item.name;
      eyebrowEl.textContent = item.eyebrow;
      titleEl.textContent = item.name;
      descEl.innerHTML = item.desc;
      priceEl.textContent = item.price;
      if (ctaEl) {
        ctaEl.dataset.id = item.id;
        ctaEl.dataset.name = item.name;
        ctaEl.dataset.price = item.price;
        ctaEl.dataset.img = item.img || "";
        ctaEl.textContent = "Ajouter au panier · " + item.price;
        ctaEl.classList.remove("is-added");
      }

      const w = panel.offsetWidth;
      const h = panel.offsetHeight;
      const first = card.getBoundingClientRect();

      panel.style.willChange = "transform";
      panel.style.transition = "none";
      panel.style.transform = transformFor(first, w, h);
      // eslint-disable-next-line no-unused-expressions
      panel.offsetHeight;

      detail.classList.add("is-open");
      detail.setAttribute("aria-hidden", "false");
      document.body.classList.add("detail-open");

      if (prefersReducedMotion) {
        panel.style.transform = restTransform(w, h);
        finishOpen();
        return;
      }

      requestAnimationFrame(() => {
        panel.style.transition = `transform ${MS.narrative}ms ${EASE_OUT}`;
        panel.style.transform = restTransform(w, h);
        const onEnd = (e) => {
          if (e.target !== panel || e.propertyName !== "transform") return;
          panel.removeEventListener("transitionend", onEnd);
          finishOpen();
        };
        panel.addEventListener("transitionend", onEnd);
      });
    }

    function finishOpen() {
      detail.classList.add("is-settled");
      isAnimating = false;
      closeBtn.focus({ preventScroll: true });
    }

    function close() {
      if (isAnimating) return;
      isAnimating = true;
      detail.classList.remove("is-settled");

      const w = panel.offsetWidth;
      const h = panel.offsetHeight;
      const targetRect = originCard ? originCard.getBoundingClientRect() : null;

      if (prefersReducedMotion || !targetRect) {
        finishClose();
        return;
      }

      panel.style.transition = `transform ${MS.ui}ms ${EASE_OUT}`;
      panel.style.transform = transformFor(targetRect, w, h);
      const onEnd = (e) => {
        if (e.target !== panel || e.propertyName !== "transform") return;
        panel.removeEventListener("transitionend", onEnd);
        finishClose();
      };
      panel.addEventListener("transitionend", onEnd);
    }

    function finishClose() {
      detail.classList.remove("is-open");
      detail.setAttribute("aria-hidden", "true");
      document.body.classList.remove("detail-open");
      panel.style.transition = "";
      panel.style.transform = "";
      panel.style.willChange = "";
      isAnimating = false;
      if (originCard) originCard.focus({ preventScroll: true });
      originCard = null;
    }

    document.addEventListener("click", (e) => {
      if (e.target.closest("[data-add-item]")) return; // let the cart handle it
      const card = e.target.closest(".card");
      if (!card) return;
      const item = ALL.find((i) => i.id === card.dataset.id);
      if (item) open(item, card);
    });

    document.addEventListener("keydown", (e) => {
      if (e.key !== "Enter" && e.key !== " ") return;
      if (e.target.closest("[data-add-item]")) return;
      const card = e.target.closest(".card");
      if (!card) return;
      e.preventDefault();
      const item = ALL.find((i) => i.id === card.dataset.id);
      if (item) open(item, card);
    });

    closeBtn.addEventListener("click", close);
    scrim.addEventListener("click", close);
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && detail.classList.contains("is-open")) close();
    });

    document.addEventListener("keydown", (e) => {
      if (e.key !== "Tab" || !detail.classList.contains("is-open")) return;
      const focusable = panel.querySelectorAll('a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])');
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    });
  }

  /* ==========================================================================
     9. Cart — persisted in localStorage, shared across the 3 pages. There's
     no payment processor here by design (see chat): the drawer produces a
     ready-to-send order summary and hands off to WhatsApp / email, where a
     human confirms and takes payment as usual.
     ========================================================================== */
  const CART_KEY = "laflamme_cart_v1";
  const WHATSAPP_NUMBER = "33952991480"; // 09 52 99 14 80 in international format
  const ORDER_EMAIL = "laflammerestaurant25@gmail.com";

  function loadCart() {
    try { return JSON.parse(localStorage.getItem(CART_KEY)) || []; }
    catch (e) { return []; }
  }
  function saveCart(items) {
    try { localStorage.setItem(CART_KEY, JSON.stringify(items)); } catch (e) { /* storage unavailable — cart stays in-memory for this page view */ }
  }

  function initCart() {
    const cartBtn = document.getElementById("cartBtn");
    const cartBadge = document.querySelector(".nav__cart-badge");
    const cartEl = document.getElementById("cart");
    const cartScrim = document.getElementById("cartScrim");
    const cartClose = document.getElementById("cartClose");
    const cartItemsEl = document.getElementById("cartItems");
    const cartTotalEl = document.getElementById("cartTotal");
    const cartWhatsapp = document.getElementById("cartWhatsapp");
    const cartEmail = document.getElementById("cartEmail");
    if (!cartBtn || !cartEl) return;

    let items = loadCart();

    function buildMessage(total) {
      if (!items.length) return "Bonjour La Flamme, je souhaite passer une commande.";
      const lines = items.map((i) => `• ${i.qty}x ${i.name} — ${formatPrice(i.price * i.qty)}`);
      return `Bonjour La Flamme 👋\nJe souhaite commander :\n${lines.join("\n")}\n\nTotal : ${formatPrice(total)}\n\nMerci de me confirmer la disponibilité et le mode de retrait 🙏`;
    }

    function render() {
      const count = items.reduce((n, i) => n + i.qty, 0);
      if (cartBadge) {
        cartBadge.textContent = String(count);
        cartBadge.classList.toggle("is-visible", count > 0);
      }
      if (cartItemsEl) {
        cartItemsEl.innerHTML = !items.length
          ? '<p class="cart__empty">Votre panier est vide.<br>Ajoutez des plats depuis la carte ou les bons plans.</p>'
          : items.map((i) => `
            <div class="cart__row" data-row="${i.id}">
              <div class="cart__row-thumb">${i.img ? `<img src="${IMG_BASE}${i.img}" alt="">` : ""}</div>
              <div class="cart__row-body">
                <div class="cart__row-name">${i.name}</div>
                <div class="cart__row-price">${formatPrice(i.price)} / unité</div>
                <div class="cart__row-actions">
                  <div class="cart__qty">
                    <button type="button" data-qty="-1" aria-label="Retirer un ${i.name}">−</button>
                    <span>${i.qty}</span>
                    <button type="button" data-qty="1" aria-label="Ajouter un ${i.name}">+</button>
                  </div>
                  <span class="cart__row-total">${formatPrice(i.price * i.qty)}</span>
                </div>
                <button type="button" class="cart__row-remove" data-remove>Retirer</button>
              </div>
            </div>`).join("");
      }
      const total = items.reduce((sum, i) => sum + i.price * i.qty, 0);
      if (cartTotalEl) cartTotalEl.textContent = formatPrice(total);

      const message = buildMessage(total);
      if (cartWhatsapp) cartWhatsapp.href = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
      if (cartEmail) cartEmail.href = `mailto:${ORDER_EMAIL}?subject=${encodeURIComponent("Commande La Flamme")}&body=${encodeURIComponent(message)}`;
    }

    function persistAndRender() {
      saveCart(items);
      render();
    }

    function openCart() {
      render();
      cartEl.classList.add("is-open");
      cartEl.setAttribute("aria-hidden", "false");
      document.body.classList.add("cart-open");
    }
    function closeCart() {
      cartEl.classList.remove("is-open");
      cartEl.setAttribute("aria-hidden", "true");
      document.body.classList.remove("cart-open");
    }

    // Fly-to-cart: a cloned thumbnail travels from the clicked button (or
    // its nearest product image) to the cart icon, so the item visibly
    // "arrives" in the cart rather than just incrementing a number
    // (motion-system.md §1.4 spatialité — the item's destination is shown,
    // not just implied).
    function flyToCart(btn) {
      if (prefersReducedMotion) return;
      const container = btn.closest(".card, .sizepicker, .cart__row, .detail__panel");
      const img = container ? container.querySelector("img") : null;
      const startEl = img || btn;
      const startRect = startEl.getBoundingClientRect();
      const endRect = cartBtn.getBoundingClientRect();
      const size = 44;

      const thumb = document.createElement("div");
      thumb.className = "fly-thumb";
      if (img && img.currentSrc) {
        const clone = document.createElement("img");
        clone.src = img.currentSrc;
        clone.alt = "";
        thumb.appendChild(clone);
      }
      document.body.appendChild(thumb);

      const startX = startRect.left + startRect.width / 2 - size / 2;
      const startY = startRect.top + startRect.height / 2 - size / 2;
      const endX = endRect.left + endRect.width / 2 - size / 2;
      const endY = endRect.top + endRect.height / 2 - size / 2;

      thumb.style.transform = `translate(${startX}px, ${startY}px) scale(1)`;
      // eslint-disable-next-line no-unused-expressions
      thumb.offsetHeight; // force reflow before the transition kicks in
      thumb.style.transition = "transform 600ms cubic-bezier(.55,0,.85,.35), opacity 600ms ease-in";

      requestAnimationFrame(() => {
        thumb.style.transform = `translate(${endX}px, ${endY}px) scale(.3)`;
        thumb.style.opacity = "0.25";
      });

      window.setTimeout(() => {
        thumb.remove();
        bumpCart();
      }, 620);
    }

    function bumpCart() {
      cartBtn.classList.remove("is-bumped");
      // eslint-disable-next-line no-unused-expressions
      cartBtn.offsetWidth; // restart the animation even on rapid repeat clicks
      cartBtn.classList.add("is-bumped");
      window.setTimeout(() => cartBtn.classList.remove("is-bumped"), 500);
    }

    // Upsell — after adding a "meal" item (anything that isn't already a
    // dessert or a drink), suggest a dessert not already in the cart. Never
    // suggests itself again (data-no-upsell on the toast's own button) and
    // never stacks more than one toast at a time.
    const UPSELL_EXCLUDE = new Set([...DESSERTS.map((d) => d.id), ...MENU.boissons.map((b) => b.id)]);
    let upsellToastEl = null;
    let upsellTimer = null;

    function showUpsellToast(item) {
      if (upsellToastEl) upsellToastEl.remove();
      if (upsellTimer) window.clearTimeout(upsellTimer);

      const toast = document.createElement("div");
      toast.className = "upsell-toast";
      toast.innerHTML = `
        <div class="upsell-toast__media"><img src="${IMG_BASE}${item.img}" alt="" loading="lazy"></div>
        <div class="upsell-toast__body">
          <p class="upsell-toast__label">Envie d'un dessert avec ça ?</p>
          <p class="upsell-toast__name">${item.name} — ${item.price}</p>
        </div>
        <button type="button" class="btn btn--primary btn--sm" data-add-item data-no-upsell
            data-id="${item.id}" data-name="${item.name}" data-price="${item.price}" data-img="${item.img}">Ajouter</button>
        <button type="button" class="upsell-toast__close" aria-label="Fermer la suggestion">&times;</button>`;
      document.body.appendChild(toast);
      upsellToastEl = toast;

      requestAnimationFrame(() => requestAnimationFrame(() => toast.classList.add("is-visible")));

      const dismiss = () => {
        toast.classList.remove("is-visible");
        window.setTimeout(() => toast.remove(), MS.ui);
        if (upsellToastEl === toast) upsellToastEl = null;
      };
      toast.querySelector(".upsell-toast__close").addEventListener("click", dismiss);
      upsellTimer = window.setTimeout(dismiss, 6000);
    }

    function maybeSuggestUpsell(addedBtn, addedId) {
      if (addedBtn.dataset.noUpsell !== undefined) return;
      if (UPSELL_EXCLUDE.has(addedId)) return;
      const inCartIds = new Set(items.map((i) => i.id));
      const suggestion = DESSERTS.find((d) => !inCartIds.has(d.id)) || DESSERTS[0];
      showUpsellToast(suggestion);
    }

    cartBtn.addEventListener("click", openCart);
    if (cartClose) cartClose.addEventListener("click", closeCart);
    if (cartScrim) cartScrim.addEventListener("click", closeCart);
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && cartEl.classList.contains("is-open")) closeCart();
    });

    if (cartItemsEl) {
      cartItemsEl.addEventListener("click", (e) => {
        const row = e.target.closest(".cart__row");
        if (!row) return;
        const id = row.dataset.row;
        const item = items.find((i) => i.id === id);
        if (!item) return;

        const qtyBtn = e.target.closest("[data-qty]");
        if (qtyBtn) {
          item.qty += Number(qtyBtn.dataset.qty);
          if (item.qty <= 0) items = items.filter((i) => i.id !== id);
          persistAndRender();
          return;
        }
        if (e.target.closest("[data-remove]")) {
          items = items.filter((i) => i.id !== id);
          persistAndRender();
        }
      });
    }

    // Delegated add-to-cart — works for every [data-add-item] on the page:
    // menu rows, Tex Mex size pills, grid cards, the detail overlay's CTA.
    document.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-add-item]");
      if (!btn) return;
      const id = btn.dataset.id;
      const existing = items.find((i) => i.id === id);
      if (existing) existing.qty += 1;
      else items.push({ id, name: btn.dataset.name, price: parsePrice(btn.dataset.price), img: btn.dataset.img || "", qty: 1 });
      persistAndRender();

      flyToCart(btn);
      maybeSuggestUpsell(btn, id);

      const original = btn.textContent;
      btn.classList.add("is-added");
      btn.textContent = "Ajouté ✓";
      window.setTimeout(() => {
        btn.classList.remove("is-added");
        btn.textContent = original;
      }, prefersReducedMotion ? 400 : 1100);
    });

    render();
  }

  /* ---- 10. Custom cursor — desktop/fine-pointer only ------------------------ */
  function initCursor() {
    if (prefersReducedMotion) return;
    if (!window.matchMedia("(pointer: fine)").matches) return;

    const dot = document.createElement("div");
    dot.className = "cursor-dot";
    dot.setAttribute("aria-hidden", "true");
    const ring = document.createElement("div");
    ring.className = "cursor-ring";
    ring.setAttribute("aria-hidden", "true");
    document.body.append(dot, ring);
    document.body.classList.add("has-custom-cursor");

    let mouseX = window.innerWidth / 2;
    let mouseY = window.innerHeight / 2;
    let ringX = mouseX;
    let ringY = mouseY;
    dot.style.transform = `translate(${mouseX}px, ${mouseY}px) translate(-50%, -50%)`;
    ring.style.transform = `translate(${ringX}px, ${ringY}px) translate(-50%, -50%)`;

    window.addEventListener("mousemove", (e) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
      dot.style.transform = `translate(${mouseX}px, ${mouseY}px) translate(-50%, -50%)`;
    }, { passive: true });

    // The ring lags behind the dot (lerp) — a soft trailing feel rather
    // than 1:1 tracking, reserved for this one ambient effect only.
    function loop() {
      ringX += (mouseX - ringX) * 0.18;
      ringY += (mouseY - ringY) * 0.18;
      ring.style.transform = `translate(${ringX}px, ${ringY}px) translate(-50%, -50%)`;
      requestAnimationFrame(loop);
    }
    requestAnimationFrame(loop);

    const HOVER_TARGETS = "a, button, .card, input, .tabs__btn";
    document.addEventListener("mouseover", (e) => {
      if (e.target.closest(HOVER_TARGETS)) ring.classList.add("is-active");
    });
    document.addEventListener("mouseout", (e) => {
      if (e.target.closest(HOVER_TARGETS)) ring.classList.remove("is-active");
    });
    document.addEventListener("mouseleave", () => { dot.style.opacity = "0"; ring.style.opacity = "0"; });
    document.addEventListener("mouseenter", () => { dot.style.opacity = "1"; ring.style.opacity = "1"; });
  }

  /* ---- Boot ---------------------------------------------------------------- */
  document.addEventListener("DOMContentLoaded", () => {
    renderCards();
    renderMenu();
    renderCarousel();
    initNav();
    initTabs();
    initSizePickers();
    initCart();
    initDetailOverlay();
    initReveal();
    initHeroScrollDepth();
    initKenBurns();
    initCursor();
    playHeroEntrance();
  });
})();
