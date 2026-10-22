(() => {
  const renderIcons = (root = document) => {
    if (!window.lucide?.createIcons) return;
    window.lucide.createIcons({
      icons: window.lucide.icons,
      root,
      attrs: { class: "lucide-icon", "stroke-width": 1.7 },
    });
  };

  window.refreshLucideIcons = renderIcons;
  document.addEventListener("DOMContentLoaded", () => renderIcons());
})();
