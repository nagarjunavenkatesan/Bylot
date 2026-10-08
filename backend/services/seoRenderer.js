const fs = require("fs");
const path = require("path");
const { pool } = require("../config/db");

const BASE_URL = "https://bylot.in";
const DEFAULT_IMAGE = `${BASE_URL}/og-image.png`;

const VALID_CITIES = ["bengaluru", "chennai", "coimbatore", "trichy", "mumbai", "hyderabad"];
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
const VALID_STATIC_PAGES = [
  "/",
  "/browse",
  "/about",
  "/contact",
  "/faq",
  "/terms",
  "/privacy"
];
const AUTH_MEMBER_PAGES = [
  "/login",
  "/register",
  "/reset-password",
  "/verify-email",
  "/sell",
  "/profile",
  "/admin",
  "/seller/orders"
];

function slugToTitle(slug = "") {
  return slug
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/**
 * Validate path and generate appropriate HTTP status code, meta tags, and JSON-LD
 */
async function validateAndGetPageSeo(reqPath, query = {}) {
  const cleanPath = (reqPath.replace(/\/+$/, "") || "/").toLowerCase();

  // 1. Homepage
  if (cleanPath === "/") {
    return {
      status: 200,
      title: "Bylot – Buy Near-Expiry & Discounted Goods Near You | Save Up to 70%",
      description: "Bylot is India's premier hyperlocal marketplace for near-expiry, surplus, and discounted essentials. Connect with verified local stores to save up to 70%.",
      canonical: `${BASE_URL}/`,
      image: DEFAULT_IMAGE,
      robots: "index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1",
      jsonLd: {
        "@context": "https://schema.org",
        "@type": "WebSite",
        name: "Bylot",
        url: BASE_URL,
        potentialAction: {
          "@type": "SearchAction",
          target: {
            "@type": "EntryPoint",
            urlTemplate: `${BASE_URL}/browse?q={search_term_string}`
          },
          "query-input": "required name=search_term_string"
        }
      }
    };
  }

  // 2. Browse / Search
  if (cleanPath === "/browse") {
    const hasSearchOrFilter = Object.keys(query).length > 0;
    return {
      status: 200,
      title: "Browse Discounted & Near-Expiry Deals | Bylot Marketplace",
      description: "Explore all active discounts, surplus food, daily essentials, and near-expiry deals near you on Bylot.",
      canonical: `${BASE_URL}/browse`,
      image: DEFAULT_IMAGE,
      robots: hasSearchOrFilter ? "noindex, follow" : "index, follow",
      jsonLd: null
    };
  }

  // 3. Static public pages
  if (VALID_STATIC_PAGES.includes(cleanPath)) {
    const titleMap = {
      "/about": "About Us – India's Hyperlocal Discount Marketplace | Bylot",
      "/contact": "Contact Us – Customer Support & Partnerships | Bylot",
      "/faq": "Frequently Asked Questions | Bylot Marketplace",
      "/terms": "Terms & Conditions of Service | Bylot",
      "/privacy": "Privacy Policy & Data Security | Bylot"
    };
    return {
      status: 200,
      title: titleMap[cleanPath] || `Bylot – ${slugToTitle(cleanPath.slice(1))}`,
      description: `Official ${cleanPath.slice(1)} information page for Bylot marketplace.`,
      canonical: `${BASE_URL}${cleanPath}`,
      image: DEFAULT_IMAGE,
      robots: "index, follow",
      jsonLd: null
    };
  }

  // 4. Auth & Member private pages
  if (AUTH_MEMBER_PAGES.includes(cleanPath) || cleanPath.startsWith("/edit-item/")) {
    return {
      status: 200,
      title: `Bylot Account – ${slugToTitle(cleanPath.replace(/^\//, ""))}`,
      description: "Secure Bylot user portal.",
      canonical: `${BASE_URL}${cleanPath}`,
      image: DEFAULT_IMAGE,
      robots: "noindex, nofollow",
      jsonLd: null
    };
  }

  // 5. Product Page: /product/:id
  const productMatch = cleanPath.match(/^\/product\/([^/]+)$/);
  if (productMatch) {
    const rawId = productMatch[1];
    try {
      const isNum = /^\d+$/.test(rawId);
      const [rows] = await pool.query(
        `SELECT p.id, p.product_item_id, p.name, p.description, p.mrp, p.selling_price, p.stock_quantity,
                p.expiry_date, p.status, p.image_url, s.business_name AS seller_name, c.name AS category_name
         FROM products p
         LEFT JOIN sellers s ON s.id = p.seller_id
         LEFT JOIN categories c ON c.id = p.category_id
         WHERE ${isNum ? "p.id = ? OR p.product_item_id = ?" : "p.product_item_id = ?"}
         LIMIT 1`,
        isNum ? [Number(rawId), rawId] : [rawId]
      );

      const product = rows[0];

      if (!product) {
        return {
          status: 404,
          title: "Product Not Found | Bylot",
          description: "The requested product does not exist or has been removed from Bylot.",
          canonical: `${BASE_URL}${cleanPath}`,
          image: DEFAULT_IMAGE,
          robots: "noindex, nofollow",
          jsonLd: null
        };
      }

      if (product.status === "deleted") {
        return {
          status: 404,
          title: "Product No Longer Available | Bylot",
          description: "This product listing was removed or deleted by the seller.",
          canonical: `${BASE_URL}${cleanPath}`,
          image: DEFAULT_IMAGE,
          robots: "noindex, nofollow",
          jsonLd: null
        };
      }

      if (product.status === "blocked" || product.status === "inactive" || product.status === "draft") {
        return {
          status: 404,
          title: "Product Unavailable | Bylot",
          description: "This product listing is currently inactive or unavailable.",
          canonical: `${BASE_URL}${cleanPath}`,
          image: DEFAULT_IMAGE,
          robots: "noindex, nofollow",
          jsonLd: null
        };
      }

      const price = Number(product.selling_price || 0);
      const mrp = Number(product.mrp || 0);
      const isExpired = product.expiry_date && new Date(product.expiry_date) < new Date();
      const isAvailable = (product.status === "active" || product.status === "available") && !isExpired;

      const title = `${product.name} – ₹${price} | Bylot`;
      const description = `Buy ${product.name} at ₹${price}${mrp ? ` (MRP ₹${mrp})` : ""} on Bylot. ${product.description ? product.description.slice(0, 140) : "Fresh surplus and near-expiry deals verified on Bylot."}`;
      const image = product.image_url ? (product.image_url.startsWith("http") ? product.image_url : `${BASE_URL}${product.image_url}`) : DEFAULT_IMAGE;
      const canonicalUrl = `${BASE_URL}/product/${product.id}`;

      const offerObj = {
        "@type": "Offer",
        url: canonicalUrl,
        priceCurrency: "INR",
        price: String(price),
        availability: product.stock_quantity > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
        seller: {
          "@type": "LocalBusiness",
          name: product.seller_name || "Verified Bylot Seller"
        }
      };

      if (product.expiry_date) {
        offerObj.priceValidUntil = new Date(product.expiry_date).toISOString().split("T")[0];
      }

      const jsonLd = {
        "@context": "https://schema.org",
        "@type": "Product",
        name: product.name,
        description: product.description || description,
        image,
        sku: String(product.product_item_id || product.id),
        offers: offerObj
      };

      if (product.seller_name) {
        jsonLd.brand = {
          "@type": "Brand",
          name: product.seller_name
        };
      }

      return {
        status: 200,
        title,
        description,
        canonical: canonicalUrl,
        image,
        robots: isAvailable
          ? "index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1"
          : "noindex, follow",
        jsonLd
      };
    } catch (err) {
      console.warn("[SEO] Product lookup error:", err.message);
      return {
        status: 404,
        title: "Product Not Found | Bylot",
        description: "The requested product does not exist.",
        canonical: `${BASE_URL}${cleanPath}`,
        image: DEFAULT_IMAGE,
        robots: "noindex, nofollow",
        jsonLd: null
      };
    }
  }

  // 6. Category Page: /category/:slug
  const categoryMatch = cleanPath.match(/^\/category\/([^/]+)$/);
  if (categoryMatch) {
    const slug = categoryMatch[1];
    let cat = null;
    try {
      const [rows] = await pool.query(
        "SELECT id, name, slug, description FROM categories WHERE slug = ? AND is_active = 1 LIMIT 1",
        [slug]
      );
      cat = rows[0];
    } catch (err) {
      console.warn("[SEO] Category lookup error:", err.message);
    }

    if (!cat && FALLBACK_CATEGORY_SLUGS.includes(slug)) {
      cat = { name: slugToTitle(slug), slug, description: `${slugToTitle(slug)} deals` };
    }

    if (!cat) {
      return {
        status: 404,
        title: "Category Not Found | Bylot",
        description: "The requested product category does not exist.",
        canonical: `${BASE_URL}${cleanPath}`,
        image: DEFAULT_IMAGE,
        robots: "noindex, nofollow",
        jsonLd: null
      };
    }

      const title = `${cat.name} Deals & Near-Expiry Items | Save Up to 70% | Bylot`;
      const description = `Find discounted ${cat.name.toLowerCase()}, surplus stock, and near-expiry essentials from local stores on Bylot.`;
      const canonicalUrl = `${BASE_URL}/category/${cat.slug}`;

      return {
        status: 200,
        title,
        description,
        canonical: canonicalUrl,
        image: DEFAULT_IMAGE,
        robots: "index, follow",
        jsonLd: {
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "Home", item: `${BASE_URL}/` },
            { "@type": "ListItem", position: 2, name: "Categories", item: `${BASE_URL}/browse` },
            { "@type": "ListItem", position: 3, name: cat.name, item: canonicalUrl }
          ]
        }
      };
  }

  // 7. Location Page: /location/:city or /location/:city/:category
  const locationMatch = cleanPath.match(/^\/location\/([^/]+)(?:\/([^/]+))?$/);
  if (locationMatch) {
    const citySlug = locationMatch[1];
    const catSlug = locationMatch[2];

    if (VALID_CITIES.includes(citySlug)) {
      const cleanCity = slugToTitle(citySlug);
      const cleanCat = catSlug ? slugToTitle(catSlug) : "";
      const canonicalUrl = `${BASE_URL}/location/${citySlug}${catSlug ? `/${catSlug}` : ""}`;

      const title = cleanCat
        ? `Discounted ${cleanCat} in ${cleanCity} | Near-Expiry Deals | Bylot`
        : `Discounted Groceries & Near-Expiry Stores in ${cleanCity} | Bylot`;

      const description = cleanCat
        ? `Shop discounted ${cleanCat.toLowerCase()} and surplus items near you in ${cleanCity}. Save up to 70% off MRP from local sellers.`
        : `Discover surplus groceries, near-expiry food items, and daily essentials at up to 70% off from local shops in ${cleanCity}.`;

      return {
        status: 200,
        title,
        description,
        canonical: canonicalUrl,
        image: DEFAULT_IMAGE,
        robots: "index, follow",
        jsonLd: [
          {
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: [
              { "@type": "ListItem", position: 1, name: "Home", item: `${BASE_URL}/` },
              { "@type": "ListItem", position: 2, name: "Locations", item: `${BASE_URL}/browse` },
              { "@type": "ListItem", position: 3, name: cleanCity, item: `${BASE_URL}/location/${citySlug}` }
            ]
          },
          {
            "@context": "https://schema.org",
            "@type": "LocalBusiness",
            name: `Bylot ${cleanCity} Hyperlocal Marketplace`,
            description: `Hyperlocal discount and near-expiry marketplace connecting local stores and consumers in ${cleanCity}.`,
            url: canonicalUrl,
            address: {
              "@type": "PostalAddress",
              addressLocality: cleanCity,
              addressCountry: "IN"
            }
          }
        ]
      };
    } else {
      return {
        status: 404,
        title: "Location Not Found | Bylot",
        description: "The requested hyperlocal location is not supported on Bylot.",
        canonical: `${BASE_URL}${cleanPath}`,
        image: DEFAULT_IMAGE,
        robots: "noindex, nofollow",
        jsonLd: null
      };
    }
  }

  // 8. Seller Page: /seller/:id
  const sellerMatch = cleanPath.match(/^\/seller\/([^/]+)$/);
  if (sellerMatch) {
    const rawId = sellerMatch[1];
    if (/^\d+$/.test(rawId)) {
      try {
        const [rows] = await pool.query(
          "SELECT id, business_name, city, approval_status, status FROM sellers WHERE id = ? AND approval_status = 'approved' AND status = 'active' LIMIT 1",
          [Number(rawId)]
        );
        const seller = rows[0];

        if (!seller) {
          return {
            status: 404,
            title: "Seller Profile Not Found | Bylot",
            description: "The requested seller storefront does not exist or is currently inactive.",
            canonical: `${BASE_URL}${cleanPath}`,
            image: DEFAULT_IMAGE,
            robots: "noindex, nofollow",
            jsonLd: null
          };
        }

        const title = `${seller.business_name} – Store Deals & Near-Expiry Goods in ${seller.city || "India"} | Bylot`;
        const description = `Shop near-expiry products, fresh produce, and discounted groceries directly from ${seller.business_name} in ${seller.city || "India"} on Bylot.`;
        const canonicalUrl = `${BASE_URL}/seller/${seller.id}`;

        return {
          status: 200,
          title,
          description,
          canonical: canonicalUrl,
          image: DEFAULT_IMAGE,
          robots: "index, follow",
          jsonLd: {
            "@context": "https://schema.org",
            "@type": "LocalBusiness",
            name: seller.business_name,
            description,
            url: canonicalUrl,
            address: {
              "@type": "PostalAddress",
              addressLocality: seller.city || "India",
              addressCountry: "IN"
            }
          }
        };
      } catch (err) {
        console.warn("[SEO] Seller lookup error:", err.message);
      }
    }

    return {
      status: 404,
      title: "Seller Profile Not Found | Bylot",
      description: "The requested seller storefront does not exist.",
      canonical: `${BASE_URL}${cleanPath}`,
      image: DEFAULT_IMAGE,
      robots: "noindex, nofollow",
      jsonLd: null
    };
  }

  // 9. Completely Unknown Route
  return {
    status: 404,
    title: "404 Page Not Found | Bylot",
    description: "The page you are looking for does not exist on Bylot.",
    canonical: `${BASE_URL}${cleanPath}`,
    image: DEFAULT_IMAGE,
    robots: "noindex, nofollow",
    jsonLd: null
  };
}

/**
 * Replace placeholders in dist/index.html string with dynamic page SEO metadata
 */
function renderHtmlWithSeo(htmlTemplate, seoOptions) {
  if (!htmlTemplate || typeof htmlTemplate !== "string") return "";

  let html = htmlTemplate;

  // Title
  if (seoOptions.title) {
    html = html.replace(/<title>.*?<\/title>/i, `<title>${escapeHtml(seoOptions.title)}</title>`);
  }

  // Description
  if (seoOptions.description) {
    html = html.replace(
      /<meta\s+name="description"\s+content=".*?"\s*\/?>/i,
      `<meta name="description" content="${escapeHtml(seoOptions.description)}" />`
    );
  }

  // Robots
  if (seoOptions.robots) {
    html = html.replace(
      /<meta\s+name="robots"\s+content=".*?"\s*\/?>/i,
      `<meta name="robots" content="${escapeHtml(seoOptions.robots)}" />`
    );
  }

  // Canonical
  if (seoOptions.canonical) {
    html = html.replace(
      /<link\s+rel="canonical"\s+href=".*?"\s*\/?>/i,
      `<link rel="canonical" href="${escapeHtml(seoOptions.canonical)}" />`
    );
  }

  // Open Graph Title / Description / Image / URL
  if (seoOptions.title) {
    html = html.replace(
      /<meta\s+property="og:title"\s+content=".*?"\s*\/?>/i,
      `<meta property="og:title" content="${escapeHtml(seoOptions.title)}" />`
    );
  }

  if (seoOptions.description) {
    html = html.replace(
      /<meta\s+property="og:description"\s+content=".*?"\s*\/?>/i,
      `<meta property="og:description" content="${escapeHtml(seoOptions.description)}" />`
    );
  }

  if (seoOptions.image) {
    html = html.replace(
      /<meta\s+property="og:image"\s+content=".*?"\s*\/?>/i,
      `<meta property="og:image" content="${escapeHtml(seoOptions.image)}" />`
    );
  }

  if (seoOptions.canonical) {
    html = html.replace(
      /<meta\s+property="og:url"\s+content=".*?"\s*\/?>/i,
      `<meta property="og:url" content="${escapeHtml(seoOptions.canonical)}" />`
    );
  }

  // Twitter Card
  if (seoOptions.title) {
    html = html.replace(
      /<meta\s+name="twitter:title"\s+content=".*?"\s*\/?>/i,
      `<meta name="twitter:title" content="${escapeHtml(seoOptions.title)}" />`
    );
  }

  if (seoOptions.description) {
    html = html.replace(
      /<meta\s+name="twitter:description"\s+content=".*?"\s*\/?>/i,
      `<meta name="twitter:description" content="${escapeHtml(seoOptions.description)}" />`
    );
  }

  if (seoOptions.image) {
    html = html.replace(
      /<meta\s+name="twitter:image"\s+content=".*?"\s*\/?>/i,
      `<meta name="twitter:image" content="${escapeHtml(seoOptions.image)}" />`
    );
  }

  // Inject dynamic JSON-LD if present
  if (seoOptions.jsonLd) {
    const jsonLdStr = JSON.stringify(seoOptions.jsonLd);
    const jsonLdScript = `<script type="application/ld+json" id="ssr-jsonld">${jsonLdStr}</script>`;
    html = html.replace("</head>", `  ${jsonLdScript}\n</head>`);
  }

  return html;
}

function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

module.exports = {
  validateAndGetPageSeo,
  renderHtmlWithSeo
};
