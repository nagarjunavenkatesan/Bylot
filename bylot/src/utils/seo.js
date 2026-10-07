/**
 * seo.js — Centralized SEO system, constants, and Schema.org generators for Bylot
 *
 * Usage:
 *   import { SITE, pageSEO, productSEO, categorySEO, locationSEO, sellerSEO, breadcrumbSEO, faqSEO, itemListSEO } from '../utils/seo';
 */

export const SITE = {
  name:          'Bylot',
  tagline:       'India\'s Hyperlocal Discount & Surplus Marketplace',
  url:           import.meta.env.VITE_SITE_URL || 'https://bylot.in',
  description:   "Bylot is India's premier hyperlocal marketplace for near-expiry, surplus, and discounted essentials. Connect with verified local stores in Bengaluru, Chennai, Coimbatore & Trichy to save up to 70% while reducing food waste.",
  twitterHandle: '@bylot_in',
  locale:        'en_IN',
  currency:      'INR',
  logoUrl:       '/og-image.png',
  ogImage:       '/og-image.png',
  themeColor:    '#4F46E5',
  email:         'nagarjunavenkatesan@gmail.com',
  founder:       'Nagarjuna B V',
};

/**
 * Build a canonical absolute URL.
 * @param {string} path  e.g. '/browse' or '/category/dairy'
 */
export function canonical(path = '/') {
  const clean = path.startsWith('/') ? path : `/${path}`;
  return `${SITE.url}${clean}`;
}

/**
 * Helper to clean and format text for titles and meta descriptions.
 */
export function slugToTitle(slug = '') {
  return slug
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Return a complete, standardized SEO configuration object.
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

  const cleanDescription = description || SITE.description;
  const canonicalUrl = canonical(path);
  const ogImageUrl = image
    ? (image.startsWith('http') ? image : `${SITE.url}${image.startsWith('/') ? '' : '/'}${image}`)
    : `${SITE.url}${SITE.ogImage}`;

  return {
    title: fullTitle,
    description: cleanDescription,
    canonical: canonicalUrl,
    image: ogImageUrl,
    type,
    noindex,
    keywords,
    structuredData,
  };
}

/**
 * Build rich SEO configuration for a single product.
 */
export function productSEO(product) {
  if (!product) return pageSEO({ title: 'Product Details', path: '/browse' });

  const price = product.selling_price || product.price || 0;
  const mrp = product.mrp || 0;
  const savingsPercent = (mrp > price && mrp > 0)
    ? Math.round(((mrp - price) / mrp) * 100)
    : 0;

  const savingsText = savingsPercent > 0 ? ` (Flat ${savingsPercent}% OFF)` : '';
  const locationText = product.location ? ` in ${product.location}` : '';

  const title = `${product.name} – ₹${price}${savingsText}${locationText}`;
  const description = `Buy ${product.name} at ₹${price}${mrp ? ` (MRP ₹${mrp})` : ''}${locationText}. ${product.description ? product.description.slice(0, 140) : 'Fresh surplus and near-expiry deals verified on Bylot.'}`;
  const image = product.image_url || product.image || `${SITE.url}${SITE.ogImage}`;
  const path = `/product/${product.id}`;

  const offer = {
    '@type': 'Offer',
    url: canonical(path),
    priceCurrency: 'INR',
    price: String(price),
    availability: (product.stock_quantity === undefined || product.stock_quantity > 0)
      ? 'https://schema.org/InStock'
      : 'https://schema.org/OutOfStock',
    seller: {
      '@type': 'LocalBusiness',
      name: product.seller_name || 'Verified Bylot Seller',
    },
  };

  if (product.expiry_date || product.expiry) {
    offer.priceValidUntil = product.expiry_date || product.expiry;
  }

  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    description: product.description || description,
    image,
    sku: String(product.product_item_id || product.id),
    offers: offer,
  };

  if (product.seller_name) {
    structuredData.brand = {
      '@type': 'Brand',
      name: product.seller_name,
    };
  }

  return pageSEO({
    title,
    description,
    path,
    image,
    type: 'product',
    keywords: `${product.name}, buy ${product.name} discount, near expiry ${product.name}, Bylot ${product.location || 'deals'}`,
    structuredData,
  });
}

/**
 * Build rich SEO configuration for a Category page.
 */
export function categorySEO(categoryName, slug, count = 0) {
  const formattedTitle = `${categoryName} Deals & Near-Expiry Items | Save Up to 70%`;
  const description = `Find discounted ${categoryName.toLowerCase()}, surplus stock, and near-expiry essentials from local stores on Bylot.${count ? ` Explore ${count}+ items available now.` : ''}`;
  const path = `/category/${slug}`;
  const image = `${SITE.url}${SITE.ogImage}`;

  const breadcrumbs = breadcrumbSEO([
    { name: 'Home', path: '/' },
    { name: 'Categories', path: '/browse' },
    { name: categoryName, path },
  ]);

  return pageSEO({
    title: formattedTitle,
    description,
    path,
    image,
    keywords: `${categoryName} discounts, near expiry ${categoryName}, surplus ${categoryName} India, buy ${categoryName} cheap`,
    structuredData: breadcrumbs,
  });
}

/**
 * Build rich SEO configuration for a Hyperlocal Location page.
 */
export function locationSEO(cityName, citySlug, categoryName = '') {
  const cleanCity = slugToTitle(cityName || citySlug);
  const cleanCat = categoryName ? slugToTitle(categoryName) : '';

  const path = categoryName ? `/location/${citySlug}/${categoryName.toLowerCase()}` : `/location/${citySlug}`;
  const title = cleanCat
    ? `Discounted ${cleanCat} in ${cleanCity} | Near-Expiry Store Deals`
    : `Discounted Groceries & Near-Expiry Stores in ${cleanCity} | Bylot`;

  const description = cleanCat
    ? `Shop discounted ${cleanCat.toLowerCase()} and surplus food items near you in ${cleanCity}. Save up to 70% off MRP from verified local sellers.`
    : `Discover surplus groceries, near-expiry food items, bakery, and daily essentials at up to 70% off from local shops in ${cleanCity}.`;

  const breadcrumbItems = [
    { name: 'Home', path: '/' },
    { name: 'Locations', path: '/browse' },
    { name: cleanCity, path: `/location/${citySlug}` },
  ];
  if (cleanCat) {
    breadcrumbItems.push({ name: cleanCat, path });
  }

  const structuredData = [
    breadcrumbSEO(breadcrumbItems),
    {
      '@context': 'https://schema.org',
      '@type': 'LocalBusiness',
      name: `Bylot ${cleanCity} Hyperlocal Marketplace`,
      description: `Hyperlocal discount and near-expiry marketplace connecting local stores and consumers in ${cleanCity}.`,
      url: canonical(path),
      address: {
        '@type': 'PostalAddress',
        addressLocality: cleanCity,
        addressCountry: 'IN',
      },
    }
  ];

  return pageSEO({
    title,
    description,
    path,
    keywords: `discounted groceries ${cleanCity}, near expiry products ${cleanCity}, surplus food ${cleanCity}, cheap provisions ${cleanCity}`,
    structuredData,
  });
}

/**
 * Build rich SEO configuration for a Seller storefront.
 */
export function sellerSEO(seller) {
  if (!seller) return pageSEO({ title: 'Seller Profile', path: '/browse' });

  const name = seller.store_name || seller.name || 'Local Seller';
  const city = seller.city || seller.address || 'India';
  const title = `${name} – Store Deals & Near-Expiry Goods in ${city}`;
  const description = `Shop near-expiry products, fresh produce, and discounted groceries directly from ${name} in ${city} on Bylot.`;
  const path = `/seller/${seller.id}`;
  const image = seller.avatar_url || seller.image || `${SITE.url}${SITE.ogImage}`;

  const structuredData = [
    breadcrumbSEO([
      { name: 'Home', path: '/' },
      { name: 'Sellers', path: '/browse' },
      { name, path },
    ]),
    {
      '@context': 'https://schema.org',
      '@type': 'LocalBusiness',
      name,
      description: seller.description || description,
      image,
      url: canonical(path),
      telephone: seller.phone || '',
      address: {
        '@type': 'PostalAddress',
        addressLocality: city,
        addressCountry: 'IN',
      },
    }
  ];

  return pageSEO({ title, description, path, image, structuredData });
}

/**
 * Organization structured data (injected once globally).
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
    'https://twitter.com/bylot_in',
    'https://github.com/nagarjunavenkatesan/Bylot'
  ],
};

/**
 * WebSite structured data with SearchAction.
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
 * Generate BreadcrumbList structured data schema.
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
 * Generate ItemList structured data schema for product lists.
 */
export function itemListSEO(items = [], title = 'Featured Products') {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: title,
    itemListElement: items.slice(0, 15).map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      url: canonical(`/product/${item.id}`),
      name: item.name,
    })),
  };
}
