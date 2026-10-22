(() => {
  const intro = document.getElementById("landing-intro");
  if (!intro) return;

  const duration = 2500;
  const shuffle = new Audio("/assets/sounds/shuffle.mp3");
  shuffle.preload = "auto";
  shuffle.volume = 0.68;

  let userActivatedAudio = false;
  const startShuffle = () => {
    if (userActivatedAudio) return;
    userActivatedAudio = true;
    shuffle.currentTime = 0;
    shuffle.play().catch(() => {
      userActivatedAudio = false;
    });
  };

  // Try immediately; if autoplay is blocked, play on the first user gesture.
  startShuffle();
  const unlockAudio = () => {
    if (!userActivatedAudio) startShuffle();
    window.removeEventListener("pointerdown", unlockAudio);
    window.removeEventListener("keydown", unlockAudio);
  };
  window.addEventListener("pointerdown", unlockAudio, { once: true });
  window.addEventListener("keydown", unlockAudio, { once: true });

  window.setTimeout(() => {
    intro.remove();
    document.body.classList.remove("intro-active");
  }, duration);
})();
