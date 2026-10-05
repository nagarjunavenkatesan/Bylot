/**
 * seo.js — Centralised SEO constants and helpers for Bylot
 *
 * Usage:
 *   import { SITE, pageSEO, productSEO } from '../utils/seo';
 */

export const SITE = {
  name:        'Bylot',
  tagline:     'Reduce Losses from Expiring Goods',
  url:         import.meta.env.VITE_SITE_URL || 'https://bylot.in',
  description: "Bylot is India's hyperlocal marketplace for near-expiry, surplus and discounted goods. Find fresh produce, dairy, bakery items and daily essentials at up to 70% off from local sellers near you.",
  twitterHandle: '@bylot_in',
  locale:      'en_IN',
  currency:    'INR',
  logoUrl:     '/og-image.png',
  ogImage:     '/og-image.png',
  themeColor:  '#4F46E5',
  email:       'nagarjunavenkatesan@gmail.com',
  founder:     'Nagarjuna B V',
};

/**
 * Build a canonical URL for any path.
 * @param {string} path  e.g. '/browse' or '/product/42'
 */
export function canonical(path = '/') {
  const clean = path.startsWith('/') ? path : `/${path}`;
  return `${SITE.url}${clean}`;
}

/**
 * Return a ready-to-use SEO config object for a given page.
 * Pass the result as props to <SEOHead />.
 */
export function pageSEO({
  title,
  description,
  path = '/',
  image,
  type = 'website',
  noindex = false,
  keywords = '',
  structuredData = null,
} = {}) {
  const fullTitle = title
    ? `${title} | ${SITE.name}`
    : `${SITE.name} – ${SITE.tagline}`;

  return {
    title: fullTitle,
    description: description || SITE.description,
    canonical: canonical(path),
    image: image || `${SITE.url}${SITE.ogImage}`,
    type,
    noindex,
    keywords,
    structuredData,
  };
}

/**
 * Build rich SEO for a single product.
 */
export function productSEO(product) {
  if (!product) return pageSEO({});

  const savings = product.mrp && product.selling_price && product.mrp > product.selling_price
    ? ` Save ${Math.round(((product.mrp - product.selling_price) / product.mrp) * 100)}%!`
    : '';

  const title       = `${product.name} – ₹${product.selling_price || product.price}${savings}`;
  const description = `Buy ${product.name} near ${product.location || 'your city'} for ₹${product.selling_price || product.price}. ${product.description || 'Fresh, discounted and near-expiry products on Bylot.'}`;
  const image       = product.image_url || product.image || `${SITE.url}${SITE.ogImage}`;
  const path        = `/product/${product.id}`;

  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    description: product.description || description,
    image,
    sku: product.product_item_id || String(product.id),
    brand: { '@type': 'Brand', name: product.seller_name || 'Local Seller' },
    offers: {
      '@type': 'Offer',
      url: canonical(path),
      priceCurrency: 'INR',
      price: product.selling_price || product.price,
      priceValidUntil: product.expiry_date || '2099-12-31',
      availability: product.stock_quantity > 0
        ? 'https://schema.org/InStock'
        : 'https://schema.org/OutOfStock',
      seller: {
        '@type': 'LocalBusiness',
        name: product.seller_name || 'Local Seller',
      },
    },
  };

  return pageSEO({ title, description, path, image, type: 'product', structuredData });
}

/**
 * Organisation structured data (injected once on every page).
 */
export const ORGANISATION_SD = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: SITE.name,
  url: SITE.url,
  logo: `${SITE.url}${SITE.logoUrl}`,
  description: SITE.description,
  email: SITE.email,
  founder: { '@type': 'Person', name: SITE.founder },
  sameAs: [
    `https://twitter.com/bylot_in`,
  ],
};

/**
 * Website (Sitelinks Searchbox) structured data.
 */
export const WEBSITE_SD = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: SITE.name,
  url: SITE.url,
  potentialAction: {
    '@type': 'SearchAction',
    target: {
      '@type': 'EntryPoint',
      urlTemplate: `${SITE.url}/browse?q={search_term_string}`,
    },
    'query-input': 'required name=search_term_string',
  },
};

/**
 * Build rich SEO for a Seller storefront.
 */
export function sellerSEO(seller) {
  if (!seller) return pageSEO({ title: 'Seller Profile', path: '/seller' });

  const name = seller.store_name || seller.name || 'Local Seller';
  const title = `${name} Store – Hyperlocal Deals on Bylot`;
  const description = `Shop near-expiry products, fresh produce, and discounted groceries directly from ${name} on Bylot.`;
  const path = `/seller/${seller.id}`;
  const image = seller.avatar_url || seller.image || `${SITE.url}${SITE.ogImage}`;

  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name,
    description: seller.description || description,
    image,
    url: canonical(path),
    telephone: seller.phone || '',
    address: {
      '@type': 'PostalAddress',
      addressLocality: seller.city || seller.address || 'India',
    },
  };

  return pageSEO({ title, description, path, image, structuredData });
}

/**
 * Generate BreadcrumbList structured data schema.
 * @param {Array<{ name: string, path: string }>} items
 */
export function breadcrumbSEO(items = []) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: canonical(item.path),
    })),
  };
}

/**
 * Generate FAQPage structured data schema.
 * @param {Array<{ question: string, answer: string }>} faqs
 */
export function faqSEO(faqs = []) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map(faq => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.answer,
      },
    })),
  };
}

/**
 * Generate ItemList structured data schema.
 */
export function itemListSEO(items = [], title = 'Featured Products') {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: title,
    itemListElement: items.slice(0, 10).map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      url: canonical(`/product/${item.id}`),
      name: item.name,
    })),
  };
}

