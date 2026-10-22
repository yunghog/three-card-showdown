(() => {
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const hasMouse = window.matchMedia("(hover: hover) and (pointer: fine)").matches;

  const ambience = document.createElement("div");
  ambience.id = "luxury-ambience";
  ambience.setAttribute("aria-hidden", "true");
  ambience.innerHTML = '<span class="luxury-orb orb-one"></span><span class="luxury-orb orb-two"></span><span class="luxury-orb orb-three"></span>';
  document.body.appendChild(ambience);

  if (hasMouse) {
    const halo = document.createElement("span");
    const dot = document.createElement("span");
    halo.className = "luxury-cursor-halo";
    dot.className = "luxury-cursor";
    halo.setAttribute("aria-hidden", "true");
    dot.setAttribute("aria-hidden", "true");
    document.body.append(halo, dot);

    let pointerX = -100;
    let pointerY = -100;
    let haloX = -100;
    let haloY = -100;
    let cursorFrame = 0;
    document.addEventListener("pointermove", (event) => {
      pointerX = event.clientX;
      pointerY = event.clientY;
      document.body.classList.add("has-luxury-pointer");
      if (cursorFrame) return;
      cursorFrame = requestAnimationFrame(function paintCursor() {
        cursorFrame = 0;
        haloX += (pointerX - haloX) * .19;
        haloY += (pointerY - haloY) * .19;
        halo.style.transform = `translate3d(${haloX - 13.5}px, ${haloY - 13.5}px, 0)`;
        dot.style.transform = `translate3d(${pointerX - 2.5}px, ${pointerY - 2.5}px, 0)`;
        if (Math.abs(pointerX - haloX) > .5 || Math.abs(pointerY - haloY) > .5) cursorFrame = requestAnimationFrame(paintCursor);
      });
    }, { passive: true });
    document.addEventListener("pointerover", (event) => {
      halo.classList.toggle("is-hovering", Boolean(event.target.closest("a, button, input, [role='button'], .card")));
    }, { passive: true });
    document.addEventListener("pointerleave", () => document.body.classList.remove("has-luxury-pointer"));
  }

  const orbs = [...ambience.querySelectorAll(".luxury-orb")];
  const heroCards = [...document.querySelectorAll(".floating-card-3d")];
  let targetX = 0;
  let targetY = 0;
  let scrollRatio = 0;
  let frame = 0;
  const drawAtmosphere = () => {
    frame = 0;
    orbs.forEach((orb, index) => {
      const depth = (index + 1) * .12;
      orb.style.setProperty("--orb-x", `${targetX * depth}px`);
      orb.style.setProperty("--orb-y", `${targetY * depth + scrollRatio * (index % 2 ? -38 : 48)}px`);
    });
    heroCards.forEach((card, index) => {
      const depth = index + 1;
      card.style.setProperty("--pointer-shift-x", `${targetX * depth * .012}px`);
      card.style.setProperty("--pointer-shift-y", `${targetY * depth * .01 + scrollRatio * depth * 5}px`);
    });
  };
  const schedulePaint = () => {
    if (!frame) frame = requestAnimationFrame(drawAtmosphere);
  };

  if (!reducedMotion) {
    document.addEventListener("pointermove", (event) => {
      targetX = event.clientX - window.innerWidth / 2;
      targetY = event.clientY - window.innerHeight / 2;
      schedulePaint();
    }, { passive: true });
    window.addEventListener("scroll", () => {
      const available = document.documentElement.scrollHeight - window.innerHeight;
      scrollRatio = available > 0 ? window.scrollY / available : 0;
      schedulePaint();
    }, { passive: true });
    schedulePaint();
  }

  // Keep the art tactile without moving the page sections themselves.
  heroCards.forEach((card) => {
    card.style.transform = "translate3d(var(--pointer-shift-x, 0px), var(--pointer-shift-y, 0px), 0)";
  });
})();
