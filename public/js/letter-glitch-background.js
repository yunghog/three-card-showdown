/*
 * Vanilla canvas adaptation of React Bits' LetterGlitch background.
 * Keeps the character field, pointer scramble, intro flicker, flow, and click
 * effects without bringing a React runtime into this HTML/Socket.IO app.
 */
(() => {
  const canvas = document.getElementById("letter-glitch-background");
  if (!canvas) return;

  const context = canvas.getContext("2d", { alpha: true });
  if (!context) return;

  const settings = {
    characters: "ABCDEFGHIJKLMNOPQRSTUVWXYZ!@#$&*()-_+=/[]{};:<>.,0123456789",
    colors: ["#c4ff4d", "#d8c6ff", "#d4af70"],
    baseColor: "#c4b5d8",
    fontSize: 14,
    spacing: 0.6,
    density: 0.3,
    baseOpacity: 0.36,
    glitchAmount: 0.48,
    speed: 0.8,
    flow: 0.55,
    cursorRadius: 140,
    edgeFade: 0.12,
    centerFade: 0.56,
    clickEffect: "tear", // Supported: tear, burst, none.
  };
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const pointer = { x: -1000, y: -1000, inside: false };
  const grid = { cols: 0, rows: 0, cellWidth: 0, cellHeight: 0, cells: [] };
  const bursts = [];
  let width = 0;
  let height = 0;
  let ratio = 1;
  let raf = 0;
  let lastFrame = 0;
  let elapsed = 0;
  let introAt = performance.now();
  let tearAt = -Infinity;
  let tearY = 0;

  const randomChar = () => settings.characters[Math.floor(Math.random() * settings.characters.length)];
  const buildGrid = () => {
    grid.cellWidth = Math.ceil(settings.fontSize * (1 + settings.spacing));
    grid.cellHeight = Math.ceil(settings.fontSize * 1.85);
    grid.cols = Math.ceil(width / grid.cellWidth) + 1;
    grid.rows = Math.ceil(height / grid.cellHeight) + 1;
    grid.cells = Array.from({ length: grid.cols * grid.rows }, () => ({
      char: randomChar(),
      visible: Math.random() < settings.density,
      nextChange: Math.random() * 1800,
      color: Math.floor(Math.random() * settings.colors.length),
      heat: 0,
      glitch: false,
    }));
  };

  const resize = () => {
    width = Math.max(1, window.innerWidth);
    height = Math.max(1, window.innerHeight);
    ratio = Math.min(window.devicePixelRatio || 1, 1.5);
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    buildGrid();
    if (reduceMotion.matches) draw(performance.now(), true);
    else wake();
  };

  const drawThreads = (time) => {
    context.save();
    context.lineWidth = 0.7;
    for (let line = 0; line < 18; line += 1) {
      const band = line / 17;
      const baseline = height * (0.08 + band * 0.84);
      const amplitude = 5 + 12 * Math.sin(band * Math.PI);
      const color = line % 3 === 0 ? "196,255,77" : line % 3 === 1 ? "216,198,255" : "212,175,112";
      context.beginPath();
      for (let x = 0; x <= width + 18; x += 18) {
        const wave = Math.sin(x * .004 + time * .00032 + line * .38) * amplitude
          + Math.sin(x * .0022 - time * .00022 + line * .21) * amplitude * .36;
        const dx = x - pointer.x;
        const proximity = pointer.inside ? Math.max(0, 1 - Math.abs(dx) / 125) : 0;
        const push = proximity * proximity * Math.sign(baseline - pointer.y || 1) * 26;
        const y = baseline + wave + push;
        if (x === 0) context.moveTo(x, y);
        else context.lineTo(x, y);
      }
      context.strokeStyle = `rgba(${color}, ${line % 4 === 0 ? .075 : .035})`;
      context.stroke();
    }
    context.restore();
  };

  const draw = (now, still = false) => {
    raf = 0;
    const delta = lastFrame ? Math.min(64, now - lastFrame) : 32;
    lastFrame = now;
    if (!still && !reduceMotion.matches) elapsed += delta * settings.speed;
    context.clearRect(0, 0, width, height);
    context.textBaseline = "middle";
    context.font = `${settings.fontSize}px ui-monospace, 'SFMono-Regular', Menlo, Consolas, monospace`;
    drawThreads(elapsed);

    const intro = reduceMotion.matches ? 1 : Math.min(1, (now - introAt) / 1400);
    const tearActive = !reduceMotion.matches && now - tearAt < 360;
    const tearStrength = tearActive ? 1 - (now - tearAt) / 360 : 0;

    grid.cells.forEach((cell, index) => {
      const col = index % grid.cols;
      const row = Math.floor(index / grid.cols);
      const x = col * grid.cellWidth + grid.cellWidth * .5;
      const y = row * grid.cellHeight + grid.cellHeight * .55;
      const dx = x - pointer.x;
      const dy = y - pointer.y;
      const distance = Math.hypot(dx, dy);
      const nearPointer = pointer.inside && distance < settings.cursorRadius;
      const inTear = tearActive && Math.abs(y - tearY) < 42;

      if (!reduceMotion.matches && now >= cell.nextChange) {
        const nearbyBoost = nearPointer ? .2 : 0;
        cell.glitch = Math.random() < settings.glitchAmount * .16 + nearbyBoost || inTear;
        if (cell.glitch || Math.random() < .045) cell.char = randomChar();
        if (Math.random() < .035) cell.color = Math.floor(Math.random() * settings.colors.length);
        cell.nextChange = now + 90 + Math.random() * (nearPointer ? 190 : 850);
      }

      const wave = .78 + .22 * Math.sin(x * .009 + y * .006 + elapsed * .0011);
      const flow = 1 - settings.flow + settings.flow * wave;
      const pointerHeat = nearPointer ? (1 - distance / settings.cursorRadius) ** 2 : 0;
      cell.heat += (pointerHeat - cell.heat) * .16;
      const centerX = Math.abs(x - width / 2) / (width * .3);
      const centerY = Math.abs(y - height / 2) / (height * .24);
      const centerMask = settings.centerFade ? Math.min(1, Math.hypot(centerX, centerY) * settings.centerFade) : 1;
      const edgeDistance = Math.min(x, y, width - x, height - y);
      const edgeMask = settings.edgeFade ? Math.min(1, edgeDistance / Math.min(width, height) / settings.edgeFade) : 1;
      const restVisibility = cell.visible ? settings.baseOpacity * flow : .012 * flow;
      const reveal = cell.glitch ? .72 : 0;
      const clickBoost = inTear ? tearStrength * .7 : 0;
      const alpha = Math.min(1, (restVisibility + Math.max(cell.heat * .62, reveal, clickBoost)) * intro) * centerMask * edgeMask;
      if (alpha < .012) return;

      context.fillStyle = cell.glitch || cell.heat > .08 || inTear
        ? settings.colors[cell.color]
        : settings.baseColor;
      const tearOffset = inTear ? (Math.random() - .5) * 12 * tearStrength : 0;
      context.globalAlpha = alpha;
      context.fillText(cell.char, x + tearOffset, y);

      if (cell.glitch && (nearPointer || inTear)) {
        context.globalAlpha = alpha * .34;
        context.fillText(randomChar(), x + (Math.random() - .5) * 7, y + (Math.random() - .5) * 4);
      }
    });

    bursts.forEach((burst) => {
      const progress = (now - burst.at) / 620;
      if (progress >= 1) return;
      const radius = progress * 230;
      context.beginPath();
      context.arc(burst.x, burst.y, radius, 0, Math.PI * 2);
      context.strokeStyle = `rgba(216,198,255,${(1 - progress) * .24})`;
      context.lineWidth = 1;
      context.stroke();
    });
    for (let i = bursts.length - 1; i >= 0; i -= 1) if (now - bursts[i].at > 620) bursts.splice(i, 1);
    context.globalAlpha = 1;

    if (!still && !reduceMotion.matches && !document.hidden) {
      raf = window.setTimeout(() => requestAnimationFrame((time) => draw(time)), 28);
    }
  };

  function wake() {
    if (!raf && !reduceMotion.matches && !document.hidden) raf = requestAnimationFrame(draw);
  }

  const locate = (event) => {
    pointer.x = event.clientX;
    pointer.y = event.clientY;
    pointer.inside = event.clientX >= 0 && event.clientY >= 0 && event.clientX <= width && event.clientY <= height;
  };
  const onPointerMove = (event) => { locate(event); wake(); };
  const onPointerDown = (event) => {
    locate(event);
    if (!pointer.inside || reduceMotion.matches || settings.clickEffect === "none") return;
    if (settings.clickEffect === "tear") { tearAt = performance.now(); tearY = pointer.y; }
    if (settings.clickEffect === "burst") bursts.push({ x: pointer.x, y: pointer.y, at: performance.now() });
    wake();
  };

  canvas.setAttribute("aria-hidden", "true");
  window.addEventListener("resize", resize, { passive: true });
  window.addEventListener("pointermove", onPointerMove, { passive: true });
  window.addEventListener("pointerdown", onPointerDown, { passive: true });
  document.documentElement.addEventListener("pointerleave", () => { pointer.inside = false; wake(); });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && raf) { clearTimeout(raf); cancelAnimationFrame(raf); raf = 0; lastFrame = 0; }
    else wake();
  });
  reduceMotion.addEventListener?.("change", () => {
    if (raf) { clearTimeout(raf); cancelAnimationFrame(raf); raf = 0; }
    lastFrame = 0;
    if (reduceMotion.matches) draw(performance.now(), true);
    else wake();
  });

  resize();
  if (reduceMotion.matches) draw(performance.now(), true);
  else wake();
})();
