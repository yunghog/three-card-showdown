# three-card-showdown
A multiplayer three-card points game where players draw, discard, and strategically manage their hands to achieve the lowest score before calling Show.

## Search and social metadata

The landing page includes page descriptions, focused search terms, Open Graph and Twitter share cards, and structured `WebApplication` data. The room listing has its own title and share description. Private game and admin pages are marked `noindex`.

The server exposes `/robots.txt` and `/sitemap.xml` for crawlers. In production, set `PUBLIC_URL` to the public site origin (for example, `https://cards.example.com`) so these endpoints publish the correct absolute URLs. The sitemap includes the landing page and public room directory.
