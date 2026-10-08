const express = require("express");
const router = express.Router();
const { pool } = require("../config/db");

const BASE_URL = "https://bylot.in";
const ITEMS_PER_PRODUCT_SITEMAP = 2500;

const STATIC_PAGES = [
  { loc: "/", priority: "1.0", changefreq: "daily" },
  { loc: "/browse", priority: "0.9", changefreq: "hourly" },
  { loc: "/about", priority: "0.6", changefreq: "monthly" },
  { loc: "/contact", priority: "0.6", changefreq: "monthly" },
  { loc: "/faq", priority: "0.7", changefreq: "weekly" },
  { loc: "/terms", priority: "0.4", changefreq: "monthly" },
  { loc: "/privacy", priority: "0.4", changefreq: "monthly" },
];

const FALLBACK_CATEGORY_SLUGS = [
  "groceries",
  "daily-essentials",
  "near-expiry",
  "discount-products",
  "dairy",
  "vegetables",
  "fruits",
  "bakery",
  "corporate-clearance"
];

const FALLBACK_LOCATION_SLUGS = [
  "bengaluru",
  "chennai",
  "coimbatore",
  "trichy",
  "mumbai",
  "hyderabad"
];

// ── Master Sitemap Index (/sitemap.xml) ──────────────────────────────────
router.get("/sitemap.xml", async (req, res) => {
  try {
    const today = new Date().toISOString().split("T")[0];
    let productPartitions = 1;

    try {
      const [countRows] = await pool.query(
        "SELECT COUNT(*) AS total FROM products WHERE status IN ('active', 'available') AND (expiry_date IS NULL OR expiry_date >= CURDATE())"
      );
      const totalProducts = countRows[0]?.total || 0;
      productPartitions = Math.max(1, Math.ceil(totalProducts / ITEMS_PER_PRODUCT_SITEMAP));
    } catch {
      productPartitions = 1;
    }

    let productSitemapsXml = "";
    for (let p = 1; p <= productPartitions; p++) {
      productSitemapsXml += `  <sitemap>\n    <loc>${BASE_URL}/sitemap-products-${p}.xml</loc>\n    <lastmod>${today}</lastmod>\n  </sitemap>\n`;
    }

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap>
    <loc>${BASE_URL}/sitemap-pages.xml</loc>
    <lastmod>${today}</lastmod>
  </sitemap>
  <sitemap>
    <loc>${BASE_URL}/sitemap-categories.xml</loc>
    <lastmod>${today}</lastmod>
  </sitemap>
  <sitemap>
    <loc>${BASE_URL}/sitemap-locations.xml</loc>
    <lastmod>${today}</lastmod>
  </sitemap>
${productSitemapsXml}</sitemapindex>`;

    res.header("Content-Type", "application/xml");
    res.header("Cache-Control", "public, max-age=3600");
    res.send(xml);
  } catch {
    res.status(500).send("Error generating sitemap index");
  }
});

// ── Pages Sitemap (/sitemap-pages.xml) ───────────────────────────────────
router.get("/sitemap-pages.xml", (req, res) => {
  const urls = STATIC_PAGES.map((p) => {
    return `  <url>\n    <loc>${BASE_URL}${p.loc}</loc>\n    <changefreq>${p.changefreq}</changefreq>\n    <priority>${p.priority}</priority>\n  </url>`;
  }).join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>`;
  res.header("Content-Type", "application/xml");
  res.header("Cache-Control", "public, max-age=86400");
  res.send(xml);
});

// ── Categories Sitemap (/sitemap-categories.xml) ─────────────────────────
router.get("/sitemap-categories.xml", async (req, res) => {
  let categoryEntries = FALLBACK_CATEGORY_SLUGS.map(s => ({ slug: s, updated_at: null }));
  try {
    const [rows] = await pool.query("SELECT slug, updated_at FROM categories WHERE is_active = 1 ORDER BY id ASC");
    if (rows && rows.length > 0) {
      categoryEntries = rows;
    }
  } catch {
    // Fallback if DB fails
  }

  const urls = categoryEntries.map((cat) => {
    const lastmodTag = cat.updated_at ? `\n    <lastmod>${new Date(cat.updated_at).toISOString().split("T")[0]}</lastmod>` : "";
    return `  <url>\n    <loc>${BASE_URL}/category/${cat.slug}</loc>${lastmodTag}\n    <changefreq>daily</changefreq>\n    <priority>0.8</priority>\n  </url>`;
  }).join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>`;
  res.header("Content-Type", "application/xml");
  res.header("Cache-Control", "public, max-age=86400");
  res.send(xml);
});

// ── Locations Sitemap (/sitemap-locations.xml) ──────────────────────────
router.get("/sitemap-locations.xml", (req, res) => {
  const urls = FALLBACK_LOCATION_SLUGS.map((city) => {
    return `  <url>\n    <loc>${BASE_URL}/location/${city}</loc>\n    <changefreq>daily</changefreq>\n    <priority>0.8</priority>\n  </url>`;
  }).join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>`;
  res.header("Content-Type", "application/xml");
  res.header("Cache-Control", "public, max-age=86400");
  res.send(xml);
});

// ── Product Sitemap Partitions (/sitemap-products-:partition.xml) ──────
router.get("/sitemap-products-:partition.xml", async (req, res) => {
  try {
    const rawPartition = req.params.partition;
    if (!/^\d+$/.test(rawPartition)) {
      return res.status(404).header("Content-Type", "application/xml").send('<?xml version="1.0" encoding="UTF-8"?><error>Sitemap partition not found</error>');
    }
    const partition = parseInt(rawPartition, 10);
    if (partition < 1) {
      return res.status(404).header("Content-Type", "application/xml").send('<?xml version="1.0" encoding="UTF-8"?><error>Sitemap partition not found</error>');
    }

    let totalProducts = 0;
    try {
      const [countRows] = await pool.query(
        "SELECT COUNT(*) AS total FROM products WHERE status IN ('active', 'available') AND (expiry_date IS NULL OR expiry_date >= CURDATE())"
      );
      totalProducts = countRows[0]?.total || 0;
    } catch {
      totalProducts = 0;
    }

    const totalPartitions = Math.max(1, Math.ceil(totalProducts / ITEMS_PER_PRODUCT_SITEMAP));
    if (partition > totalPartitions) {
      return res.status(404).header("Content-Type", "application/xml").send('<?xml version="1.0" encoding="UTF-8"?><error>Sitemap partition not found</error>');
    }

    const offset = (partition - 1) * ITEMS_PER_PRODUCT_SITEMAP;
    let productUrls = [];

    try {
      const [rows] = await pool.query(
        `SELECT id, updated_at, created_at
         FROM products
         WHERE status IN ('active', 'available')
           AND (expiry_date IS NULL OR expiry_date >= CURDATE())
         ORDER BY id ASC
         LIMIT ? OFFSET ?`,
        [ITEMS_PER_PRODUCT_SITEMAP, offset]
      );
      productUrls = (rows || []).map((row) => {
        const date = row.updated_at || row.created_at;
        const lastmodTag = date ? `\n    <lastmod>${new Date(date).toISOString().split("T")[0]}</lastmod>` : "";
        return `  <url>\n    <loc>${BASE_URL}/product/${row.id}</loc>${lastmodTag}\n    <changefreq>daily</changefreq>\n    <priority>0.7</priority>\n  </url>`;
      });
    } catch (err) {
      console.warn("Product sitemap partition error:", err.message);
    }

    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${productUrls.join("\n")}\n</urlset>`;
    res.header("Content-Type", "application/xml");
    res.header("Cache-Control", "public, max-age=3600");
    res.send(xml);
  } catch {
    res.status(500).send("Error generating product sitemap partition");
  }
});

// ── Robots.txt ─────────────────────────────────────────────────────────
router.get("/robots.txt", (req, res) => {
  const robots = `User-agent: *
Allow: /
Allow: /browse
Allow: /category/
Allow: /location/
Allow: /product/
Allow: /seller/
Allow: /about
Allow: /contact
Allow: /faq
Allow: /terms
Allow: /privacy

Disallow: /login
Disallow: /register
Disallow: /reset-password
Disallow: /verify-email
Disallow: /profile
Disallow: /sell
Disallow: /edit-item/
Disallow: /admin
Disallow: /seller/orders
Disallow: /api/
Disallow: /uploads/
Disallow: /_vite/
Disallow: /*.map$

Sitemap: ${BASE_URL}/sitemap.xml
`;
  res.header("Content-Type", "text/plain");
  res.send(robots);
});

module.exports = router;
