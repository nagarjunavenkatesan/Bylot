/**
 * useSEO.js — Custom React Hook for Imperative Head & Schema Management
 *
 * Dynamically updates document title, meta tags, Open Graph tags,
 * Twitter Cards, canonical links, and JSON-LD structured data.
 */
import { useEffect } from 'react';
import { SITE, ORGANISATION_SD, WEBSITE_SD } from '../utils/seo';

function setMeta(name, content, attr = 'name') {
  if (!content) return;
  let el = document.head.querySelector(`meta[${attr}="${name}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, name);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function setLink(rel, href, extra = {}) {
  if (!href) return;
  let el = document.head.querySelector(`link[rel="${rel}"]`);
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', rel);
    document.head.appendChild(el);
  }
  el.setAttribute('href', href);
  Object.entries(extra).forEach(([k, v]) => el.setAttribute(k, v));
}

function setJsonLd(id, data) {
  if (!data) {
    const stale = document.head.querySelector(`script[data-seo-id="${id}"]`);
    if (stale) stale.remove();
    return;
  }
  let el = document.head.querySelector(`script[data-seo-id="${id}"]`);
  if (!el) {
    el = document.createElement('script');
    el.setAttribute('type', 'application/ld+json');
    el.setAttribute('data-seo-id', id);
    document.head.appendChild(el);
  }
  el.textContent = JSON.stringify(data);
}

export function useSEO(seoConfig = {}) {
  const {
    title,
    description,
    canonical: canonicalUrl,
    image,
    type = 'website',
    noindex = false,
    keywords = '',
    structuredData = null,
  } = seoConfig;

  useEffect(() => {
    if (title) {
      document.title = title;
    }

    setMeta('description', description);
    setMeta('keywords', keywords);
    setMeta('robots', noindex ? 'noindex, nofollow' : 'index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1');
    setMeta('author', SITE.founder);
    setMeta('theme-color', SITE.themeColor);
    setMeta('application-name', SITE.name);

    // Open Graph
    setMeta('og:site_name', SITE.name, 'property');
    setMeta('og:title', title, 'property');
    setMeta('og:description', description, 'property');
    setMeta('og:type', type, 'property');
    setMeta('og:url', canonicalUrl, 'property');
    setMeta('og:image', image, 'property');
    setMeta('og:image:width', '1200', 'property');
    setMeta('og:image:height', '630', 'property');
    setMeta('og:image:alt', title, 'property');
    setMeta('og:locale', SITE.locale, 'property');

    // Twitter Card
    setMeta('twitter:card', 'summary_large_image');
    setMeta('twitter:site', SITE.twitterHandle);
    setMeta('twitter:creator', SITE.twitterHandle);
    setMeta('twitter:title', title);
    setMeta('twitter:description', description);
    setMeta('twitter:image', image);
    setMeta('twitter:image:alt', title);

    // Canonical link
    if (canonicalUrl) {
      setLink('canonical', canonicalUrl);
    }

    // Global structured data
    setJsonLd('org', ORGANISATION_SD);
    setJsonLd('website', WEBSITE_SD);

    // Page specific structured data
    if (structuredData) {
      if (Array.isArray(structuredData)) {
        structuredData.forEach((sd, idx) => setJsonLd(`page-${idx}`, sd));
      } else {
        setJsonLd('page', structuredData);
      }
    } else {
      const stalePage = document.head.querySelector('script[data-seo-id="page"]');
      if (stalePage) stalePage.remove();
      document.head.querySelectorAll('script[data-seo-id^="page-"]').forEach(el => el.remove());
    }
  }, [title, description, canonicalUrl, image, type, noindex, keywords, structuredData]);
}

export default useSEO;
