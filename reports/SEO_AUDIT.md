# BYLOT — TECHNICAL SEO & GOOGLE SEARCH AUDIT

**Target Domain:** `https://bylot.in`  
**Site Name:** Bylot  
**Canonical Base:** `https://bylot.in/`  
**Status:** **SEARCH READY (OPTIMIZED FOR GOOGLE SEARCH CONSOLE)**

---

## 1. TECHNICAL SEO AUDIT RESULTS

### 1.1 Meta Tags & Canonicalization
- **Primary Canonical URL:** Strict canonical link `https://bylot.in/` configured in `index.html`.
- **Title Tag:** Optimized title `<title>Bylot – Buy Near-Expiry &amp; Discounted Goods Near You | Save Up to 70%</title>`.
- **Meta Description:** `<meta name="description" content="Bylot is India's hyperlocal marketplace for near-expiry, surplus and discounted goods. Find fresh produce, dairy, bakery and daily essentials at up to 70% off from local sellers near you." />`.
- **Robots Directives:** `<meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1" />`.
- **Private Route Noindex:** Private and authenticated routes (`/admin`, `/profile`, `/login`, `/register`) serve `<meta name="robots" content="noindex, nofollow" />` via `SEOHead.jsx`.

### 1.2 OpenGraph & Twitter Cards
- `og:site_name`: `Bylot`
- `og:type`: `website`
- `og:title`: `Bylot – Buy Near-Expiry & Discounted Goods Near You`
- `og:image`: `https://bylot.in/og-image.png` (1200x630px social preview image)
- `twitter:card`: `summary_large_image`

### 1.3 Robots.txt & Dynamic XML Sitemaps
Dynamic routes handled by Express backend (`backend/services/seoRenderer.js`):
- **Robots.txt (`GET /robots.txt`):**
  - Allows search engine crawlers on public catalog routes (`/`, `/browse`, `/product/*`, `/category/*`, `/location/*`, `/terms`, `/privacy`).
  - Disallows internal authenticated routes (`/api/*`, `/admin*`, `/login`, `/profile`, `/sell`).
  - Declares primary sitemap index: `Sitemap: https://bylot.in/sitemap.xml`.
- **Sitemap Index (`GET /sitemap.xml`):**
  - Dynamically lists child sitemaps:
    - `https://bylot.in/sitemap-pages.xml` (Static legal and informational pages)
    - `https://bylot.in/sitemap-categories.xml` (Category deal pages)
    - `https://bylot.in/sitemap-locations.xml` (Hyperlocal district pages)
    - `https://bylot.in/sitemap-products-1.xml` (Active non-expired product listings)

### 1.4 Structured Data (Schema.org / JSON-LD)
- `Organization` schema declaring brand name, URL, logo, and contact points.
- `Product` schema on individual product detail pages with price, availability, and expiry timestamps.
- `BreadcrumbList` schema representing catalog category hierarchy.

---

## 2. GOOGLE SEARCH CONSOLE PREPARATION

To complete Google Search Console verification after live hosting:
1. Add property `https://bylot.in` in Google Search Console.
2. Select HTML tag verification or DNS TXT record verification.
3. Submit sitemap URL: `https://bylot.in/sitemap.xml`.
