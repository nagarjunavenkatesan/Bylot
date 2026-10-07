const express = require("express");
const router = express.Router();
const { pool } = require("../config/db");

const BASE_URL = "https://bylot.in";

const STATIC_URLS = [
  { loc: "/", priority: "1.0", changefreq: "daily" },
  { loc: "/browse", priority: "0.9", changefreq: "hourly" },
  { loc: "/about", priority: "0.6", changefreq: "monthly" },
  { loc: "/contact", priority: "0.6", changefreq: "monthly" },
  { loc: "/faq", priority: "0.7", changefreq: "weekly" },
  { loc: "/terms", priority: "0.4", changefreq: "monthly" },
  { loc: "/privacy", priority: "0.4", changefreq: "monthly" },
  { loc: "/category/groceries", priority: "0.8", changefreq: "daily" },
  { loc: "/category/daily-essentials", priority: "0.8", changefreq: "daily" },
  { loc: "/category/near-expiry", priority: "0.8", changefreq: "daily" },
  { loc: "/category/discount-products", priority: "0.8", changefreq: "daily" },
  { loc: "/category/dairy", priority: "0.8", changefreq: "daily" },
  { loc: "/category/vegetables", priority: "0.8", changefreq: "daily" },
  { loc: "/category/fruits", priority: "0.8", changefreq: "daily" },
  { loc: "/category/bakery", priority: "0.8", changefreq: "daily" },
  { loc: "/category/corporate-clearance", priority: "0.8", changefreq: "daily" },
  { loc: "/location/bengaluru", priority: "0.8", changefreq: "daily" },
  { loc: "/location/chennai", priority: "0.8", changefreq: "daily" },
  { loc: "/location/coimbatore", priority: "0.8", changefreq: "daily" },
  { loc: "/location/trichy", priority: "0.8", changefreq: "daily" },
];

router.get("/sitemap.xml", async (req, res) => {
  try {
    let productUrls = [];
    try {
      const [rows] = await pool.query(
        "SELECT id, updated_at, created_at FROM products WHERE status = 'available' ORDER BY updated_at DESC LIMIT 5000"
      );
      productUrls = (rows || []).map((row) => {
        const date = row.updated_at || row.created_at || new Date();
        const formattedDate = new Date(date).toISOString().split("T")[0];
        return `  <url>\n    <loc>${BASE_URL}/product/${row.id}</loc>\n    <lastmod>${formattedDate}</lastmod>\n    <changefreq>daily</changefreq>\n    <priority>0.8</priority>\n  </url>`;
      });
    } catch (err) {
      console.warn("Dynamic sitemap product query note:", err.message);
    }

    const today = new Date().toISOString().split("T")[0];
    const staticXml = STATIC_URLS.map((item) => {
      return `  <url>\n    <loc>${BASE_URL}${item.loc}</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>${item.changefreq}</changefreq>\n    <priority>${item.priority}</priority>\n  </url>`;
    }).join("\n");

    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${staticXml}\n${productUrls.join("\n")}\n</urlset>`;

    res.header("Content-Type", "application/xml");
    res.header("Cache-Control", "public, max-age=3600");
    res.send(xml);
  } catch (error) {
    res.status(500).send("Error generating sitemap");
  }
});

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
