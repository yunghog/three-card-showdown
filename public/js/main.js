let stopCanvasEngine = null;

document.addEventListener("DOMContentLoaded", () => {
  // Fetch landing page dynamic configuration
  fetch("config/landing-page.json")
    .then((response) => {
      if (!response.ok) throw new Error("Failed to load landing page configuration.");
      return response.json();
    })
    .then((config) => {
      renderLandingPage(config);
      initializeInteractions();
    })
    .catch((err) => {
      console.error("Configuration Error:", err);
      // Fallback interaction initialize if fetch fails
      initializeInteractions();
    });
});

// Dynamic HTML Renderer driven by landing-page.json
function renderLandingPage(config) {
  const { sectionsVisibility, branding, navigation, features, howToPlaySteps, leaderboard, testimonials, faqs, footer } = config;

  // 1. Branding Updates
  if (branding) {
    document.title = `${branding.logoTextPrefix}${branding.logoTextHighlight} | Premium Points Game`;
    
    // Logo render
    const logoContainers = document.querySelectorAll(".logo");
    logoContainers.forEach((logo) => {
      logo.innerHTML = `
        <span class="logo-emoji">${branding.logoEmoji}</span>
        <span class="logo-text">${branding.logoTextPrefix}<span class="text-gold">${branding.logoTextHighlight}</span></span>
      `;
    });

    // Hero content render
    const heroBadge = document.querySelector(".hero-content .badge");
    if (heroBadge) heroBadge.textContent = branding.badgeText;

    const heroTitle = document.querySelector(".hero-title");
    if (heroTitle) {
      heroTitle.innerHTML = `${branding.heroTitlePrefix}<br/><span class="text-gold-gradient">${branding.heroTitleHighlight}</span>`;
    }

    const heroSubtitle = document.querySelector(".hero-subtitle");
    if (heroSubtitle) heroSubtitle.textContent = branding.heroSubtitle;

    // CTA Text changes
    const heroPlayBtn = document.querySelector(".hero-content .play-now-cta");
    if (heroPlayBtn) heroPlayBtn.textContent = branding.playNowButtonText;

    const heroLearnBtn = document.querySelector(".hero-content .btn-secondary");
    if (heroLearnBtn) heroLearnBtn.textContent = branding.learnMoreButtonText;

    // CTA Banner Bottom
    const ctaBannerTitle = document.querySelector(".cta-banner h2");
    if (ctaBannerTitle) ctaBannerTitle.textContent = branding.ctaBannerTitle;

    const ctaBannerDesc = document.querySelector(".cta-banner p");
    if (ctaBannerDesc) ctaBannerDesc.textContent = branding.ctaBannerDescription;

    const ctaBannerBtn = document.querySelector(".cta-banner button");
    if (ctaBannerBtn) ctaBannerBtn.textContent = branding.ctaBannerButtonText;
  }

  // 2. Sticky Header & Footer Navigation
  const navMenu = document.getElementById("nav-menu");
  const footerLinks = document.querySelector(".footer-links");

  if (navMenu && navigation) {
    navMenu.innerHTML = "";
    navigation.forEach((nav, idx) => {
      const link = document.createElement("a");
      link.href = nav.path;
      link.className = `nav-link ${idx === 0 ? "active" : ""}`;
      link.textContent = nav.name;
      navMenu.appendChild(link);
    });
  }

  if (footerLinks && navigation) {
    footerLinks.innerHTML = "";
    navigation.forEach((nav) => {
      const link = document.createElement("a");
      link.href = nav.path;
      link.className = "text-muted text-small nav-link";
      link.textContent = nav.name;
      footerLinks.appendChild(link);
    });
  }

  // 3. Features Cards Render
  const featuresGrid = document.getElementById("features-grid");
  if (featuresGrid && features) {
    featuresGrid.innerHTML = "";
    features.forEach((feat) => {
      const card = document.createElement("div");
      card.className = "glass-panel feature-card scroll-reveal";
      card.innerHTML = `
        <div class="feature-icon">${feat.icon}</div>
        <h3 class="text-gold">${feat.title}</h3>
        <p class="text-muted text-small m-0">${feat.description}</p>
      `;
      featuresGrid.appendChild(card);
    });
  }

  // 4. How to Play steps timeline render
  const timelineContainer = document.getElementById("timeline-container");
  if (timelineContainer && howToPlaySteps) {
    timelineContainer.innerHTML = "";
    howToPlaySteps.forEach((step) => {
      const item = document.createElement("div");
      item.className = "timeline-item scroll-reveal";
      item.innerHTML = `
        <div class="timeline-badge">${step.step}</div>
        <div class="timeline-content glass-panel">
          <h3 class="text-gold m-0 mb-0-5">${step.title}</h3>
          <p class="text-muted text-small m-0">${step.description}</p>
        </div>
      `;
      timelineContainer.appendChild(item);
    });
  }

  // 5. Leaderboard table rows render
  const leaderboardTableBody = document.getElementById("leaderboard-table-body");
  if (leaderboardTableBody && leaderboard) {
    leaderboardTableBody.innerHTML = "";
    leaderboard.forEach((user) => {
      const row = document.createElement("tr");
      if (user.cssClass) row.className = user.cssClass;
      row.innerHTML = `
        <td>${user.rank}</td>
        <td><strong>${user.name}</strong></td>
        <td>${user.won}</td>
        <td>${user.accuracy}</td>
        <td><strong>${user.score}</strong></td>
      `;
      leaderboardTableBody.appendChild(row);
    });
  }

  // 6. Testimonials reviews grid render
  const testimonialsGrid = document.getElementById("testimonials-grid");
  if (testimonialsGrid && testimonials) {
    testimonialsGrid.innerHTML = "";
    testimonials.forEach((test) => {
      const card = document.createElement("div");
      card.className = "glass-panel feature-card scroll-reveal";
      card.innerHTML = `
        <div class="testimonial-rating">${test.rating}</div>
        <p class="italic text-small text-muted mb-1">"${test.quote}"</p>
        <div class="text-bold text-gold text-small">— ${test.author}</div>
      `;
      testimonialsGrid.appendChild(card);
    });
  }

  // 7. FAQs accordion dynamic injection
  const faqAccordion = document.getElementById("faq-accordion");
  if (faqAccordion && faqs) {
    faqAccordion.innerHTML = "";
    faqs.forEach((faq) => {
      const item = document.createElement("div");
      item.className = "faq-item glass-panel scroll-reveal";
      item.innerHTML = `
        <button class="faq-question text-bold text-gold w-full text-left flex justify-between items-center">
          <span>${faq.question}</span>
          <span class="faq-icon">+</span>
        </button>
        <div class="faq-answer text-muted text-small hidden">${faq.answer}</div>
      `;
      faqAccordion.appendChild(item);
    });
  }

  // 8. Footer Copyright update
  const footerCopyright = document.getElementById("footer-copyright");
  if (footerCopyright && footer) {
    footerCopyright.textContent = footer.copyright;
  }

  // 9. METADATA SHOW/HIDE: Toggle Visibility states of sections
  if (sectionsVisibility) {
    const toggleSection = (id, visible) => {
      const el = document.getElementById(id);
      if (el) {
        if (visible === false) {
          el.style.display = "none";
        } else {
          el.style.display = "";
        }
      }
    };

    toggleSection("hero", sectionsVisibility.hero);
    toggleSection("features", sectionsVisibility.features);
    toggleSection("how-to-play", sectionsVisibility.howToPlay);
    toggleSection("leaderboard", sectionsVisibility.leaderboard);
    toggleSection("testimonials", sectionsVisibility.testimonials);
    toggleSection("faq", sectionsVisibility.faq);
    
    const ctaBanner = document.querySelector(".cta-banner-section");
    if (ctaBanner) {
      ctaBanner.style.display = sectionsVisibility.ctaBanner === false ? "none" : "";
    }
  }
}

// Wire up client transitions, scroll reveals, accordions, and overlays
function initializeInteractions() {
  const lobbyScreen = document.getElementById("lobby-screen");
  const usernameInput = document.getElementById("username");
  const roomIdInput = document.getElementById("room-id");
  const joinForm = document.getElementById("join-form");

  // 1. Lobby Modal toggles
  const openModalCTAs = document.querySelectorAll(".play-now-cta");
  const closeModalBtn = document.getElementById("close-lobby-btn");

  openModalCTAs.forEach((btn) => {
    btn.addEventListener("click", () => {
      if (lobbyScreen) {
        lobbyScreen.classList.remove("hidden");
        setTimeout(() => usernameInput && usernameInput.focus(), 150);
      }
    });
  });

  if (closeModalBtn && lobbyScreen) {
    closeModalBtn.addEventListener("click", () => {
      lobbyScreen.classList.add("hidden");
    });
  }

  if (lobbyScreen) {
    lobbyScreen.addEventListener("click", (e) => {
      if (e.target === lobbyScreen) {
        lobbyScreen.classList.add("hidden");
      }
    });
  }

  // 2. Play redirect logic (Redirection Loop instead of WebSocket emit on index.html)
  if (joinForm) {
    joinForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const username = usernameInput.value.trim();
      const roomId = roomIdInput.value.trim();

      if (username && roomId) {
        // Redirection with URL params to separated game screen
        window.location.href = `/game.html?username=${encodeURIComponent(username)}&room=${encodeURIComponent(roomId)}`;
      }
    });
  }

  // 3. Mobile Navigation Menu Toggle
  const mobileNavBtn = document.getElementById("mobile-nav-btn");
  const navMenu = document.getElementById("nav-menu");

  if (mobileNavBtn && navMenu) {
    mobileNavBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      navMenu.classList.toggle("mobile-active");
      mobileNavBtn.classList.toggle("open");
    });

    navMenu.querySelectorAll(".nav-link").forEach((link) => {
      link.addEventListener("click", () => {
        navMenu.classList.remove("mobile-active");
        mobileNavBtn.classList.remove("open");
      });
    });

    document.addEventListener("click", () => {
      navMenu.classList.remove("mobile-active");
      mobileNavBtn.classList.remove("open");
    });
  }

  // 4. Scroll Reveal Intersection Observer
  const revealElements = document.querySelectorAll(".scroll-reveal");
  if (revealElements.length > 0) {
    const revealObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("active");
            revealObserver.unobserve(entry.target);
          }
        });
      },
      {
        threshold: 0.08,
        rootMargin: "0px 0px -40px 0px"
      }
    );
    revealElements.forEach((el) => revealObserver.observe(el));
  }

  // 5. Sticky Header Scroll compaction and highlights
  const stickyHeader = document.querySelector(".sticky-header");
  const sections = document.querySelectorAll("section[id]");
  const navLinks = document.querySelectorAll(".nav-link");

  window.addEventListener("scroll", () => {
    if (!stickyHeader) return;

    if (window.scrollY > 40) {
      stickyHeader.classList.add("scrolled");
    } else {
      stickyHeader.classList.remove("scrolled");
    }

    // Highlighting navbar links based on scroll coordinate
    let currentSectionId = "";
    const scrollPosition = window.scrollY + 100;

    sections.forEach((sec) => {
      if (sec.style.display === "none") return; // Skip hidden elements
      const top = sec.offsetTop;
      const height = sec.offsetHeight;
      if (scrollPosition >= top && scrollPosition < top + height) {
        currentSectionId = sec.getAttribute("id");
      }
    });

    if (currentSectionId) {
      navLinks.forEach((link) => {
        link.classList.remove("active");
        if (link.getAttribute("href") === `#${currentSectionId}`) {
          link.classList.add("active");
        }
      });
    }
  });

  // 6. Accordion Toggling for FAQ Accordion Container
  const faqAccordion = document.getElementById("faq-accordion");
  if (faqAccordion) {
    faqAccordion.addEventListener("click", (e) => {
      const questionBtn = e.target.closest(".faq-question");
      if (!questionBtn) return;

      const faqItem = questionBtn.closest(".faq-item");
      const answer = faqItem.querySelector(".faq-answer");
      const icon = faqItem.querySelector(".faq-icon");
      const isActive = faqItem.classList.contains("active");

      // Accordion close all others
      const allItems = faqAccordion.querySelectorAll(".faq-item");
      allItems.forEach((item) => {
        if (item !== faqItem) {
          item.classList.remove("active");
          item.querySelector(".faq-answer").classList.add("hidden");
          item.querySelector(".faq-icon").textContent = "+";
        }
      });

      // Toggle clicked item
      if (isActive) {
        faqItem.classList.remove("active");
        answer.classList.add("hidden");
        icon.textContent = "+";
      } else {
        faqItem.classList.add("active");
        answer.classList.remove("hidden");
        icon.textContent = "−";
      }
    });
  }

  // 7. Ambient Particle Canvas Engine
  initCanvasParticles();
}

// Particle Sparks Engine
function initCanvasParticles() {
  const canvas = document.getElementById("ambient-canvas");
  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  let animationFrameId = null;
  let particlesArray = [];
  let isCanvasActive = true;

  function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  resizeCanvas();
  window.addEventListener("resize", resizeCanvas);

  class Particle {
    constructor() {
      this.x = Math.random() * canvas.width;
      this.y = Math.random() * canvas.height;
      this.size = Math.random() * 2.5 + 0.5;
      this.speedY = -(Math.random() * 0.8 + 0.2);
      this.speedX = Math.sin(Math.random() * Math.PI) * 0.15;
      this.color = Math.random() > 0.6 
        ? "rgba(212, 175, 55, " + (Math.random() * 0.4 + 0.1) + ")"
        : "rgba(56, 189, 248, " + (Math.random() * 0.3 + 0.05) + ")";
      this.swaySpeed = Math.random() * 0.02 + 0.005;
      this.swayValue = Math.random() * Math.PI;
    }

    update() {
      this.y += this.speedY;
      this.swayValue += this.swaySpeed;
      this.x += Math.sin(this.swayValue) * 0.25;

      if (this.y < -10 || this.x < -10 || this.x > canvas.width + 10) {
        this.y = canvas.height + Math.random() * 20;
        this.x = Math.random() * canvas.width;
        this.speedY = -(Math.random() * 0.8 + 0.2);
        this.size = Math.random() * 2.5 + 0.5;
      }
    }

    draw() {
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
      ctx.fillStyle = this.color;
      ctx.shadowBlur = this.size * 2;
      ctx.shadowColor = this.color;
      ctx.fill();
    }
  }

  const maxParticles = 65;
  for (let i = 0; i < maxParticles; i++) {
    particlesArray.push(new Particle());
  }

  function animate() {
    if (!isCanvasActive) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.shadowBlur = 0;

    const grad = ctx.createRadialGradient(
      canvas.width / 2, canvas.height * 0.3, 10,
      canvas.width / 2, canvas.height * 0.3, Math.max(canvas.width, canvas.height)
    );
    grad.addColorStop(0, "#0a101f");
    grad.addColorStop(1, "#05060b");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    for (let i = 0; i < particlesArray.length; i++) {
      particlesArray[i].update();
      particlesArray[i].draw();
    }

    animationFrameId = requestAnimationFrame(animate);
  }

  animate();

  stopCanvasEngine = function() {
    isCanvasActive = false;
    if (animationFrameId) {
      cancelAnimationFrame(animationFrameId);
    }
    window.removeEventListener("resize", resizeCanvas);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    canvas.style.display = "none";
  };

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      isCanvasActive = false;
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
    } else {
      isCanvasActive = true;
      animate();
    }
  });
}
