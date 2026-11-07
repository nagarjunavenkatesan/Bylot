# BYLOT — PERFORMANCE & CORE WEB VITALS REPORT

**Application:** Bylot Web Application (React + Vite)  
**Bundler:** Vite v7.3.6  
**Auditor:** Senior Performance Engineer  

---

## 1. FRONTEND BUNDLE ANALYSIS & CODE SPLITTING

The production build (`npm run build`) uses Rollup manual chunking to divide dependencies into optimized vendor bundles:

### Production Asset Breakdown (`dist/assets/`)
| Chunk Name | Size (Uncompressed) | Gzip Compressed | Purpose |
|---|---|---|---|
| `vendor-react-*.js` | 228.24 kB | 73.13 kB | React, ReactDOM, React Router |
| `vendor-framer-*.js` | 77.91 kB | 25.29 kB | Framer Motion animations |
| `vendor-libs-*.js` | 42.01 kB | 15.54 kB | Utility libraries |
| `vendor-icons-*.js` | 25.08 kB | 8.25 kB | React Icons |
| `index-*.js` | 61.09 kB | 19.08 kB | Core application router & providers |
| `index-*.css` | 44.84 kB | 9.56 kB | Global styles & design tokens |
| `AdminPanel-*.js` | 68.43 kB | 16.34 kB | Lazy-loaded Admin panel |
| `AdminPanel-*.css`| 19.93 kB | 4.46 kB | Admin panel styles |
| `Sell-*.js` | 13.27 kB | 4.10 kB | Lazy-loaded Seller product form |
| `ProductDetails-*.js` | 5.42 kB | 2.06 kB | Lazy-loaded Product details page |
| `Terms-*.js` | 6.26 kB | 1.90 kB | Lazy-loaded Terms & Conditions page |
| `Login-*.js` | 6.40 kB | 2.28 kB | Lazy-loaded Login page |
| `Register-*.js` | 7.88 kB | 2.44 kB | Lazy-loaded Registration page |

**Initial Page Load Transfer Size (Landing Page):** **~112 kB (Gzipped JS + CSS)**  
*Well under the recommended 250 kB threshold for optimal mobile performance.*

---

## 2. CORE WEB VITALS (CWV) STRATEGY

1. **Largest Contentful Paint (LCP):**
   - Preconnect to Google Fonts (`fonts.googleapis.com` and `fonts.gstatic.com`) in `index.html`.
   - Critical hero images compressed in modern WebP format.
   - Nginx gzip compression enabled with compression level 6.
2. **First Input Delay (FID) / Interaction to Next Paint (INP):**
   - Route-level code splitting via `React.lazy()` ensures minimal main-thread JavaScript execution during initial load.
3. **Cumulative Layout Shift (CLS):**
   - Image cards reserve aspect ratios with explicit CSS sizing.
   - Fallback system fonts provide minimal layout shift before web fonts load.

---

## 3. BACKEND & DATABASE PERFORMANCE

- **Connection Pool:** MySQL pool capped at 15 concurrent connections (`connectionLimit: 15`).
- **Database Indexing:** B-Tree indices applied across `expiry_date`, `category_id`, `status`, `seller_id`, and `buyer_id`.
- **In-Memory Rate Limiting:** Sliding-window rate limiters use low-overhead in-memory Maps with automatic periodic garbage collection timers.
