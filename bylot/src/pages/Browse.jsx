import React from 'react';
import Home from './Home';
import SEOHead from '../components/SEOHead';
import { pageSEO, breadcrumbSEO } from '../utils/seo';

const Browse = () => {
    const browseSEO = pageSEO({
        title: 'Browse Discounted Groceries & Near-Expiry Items',
        description: 'Explore fresh produce, dairy, bakery, and daily essentials at up to 70% off from local sellers near you.',
        path: '/browse',
        keywords: 'browse discounted groceries, buy near expiry food, local surplus marketplace',
        structuredData: breadcrumbSEO([
            { name: 'Home', path: '/' },
            { name: 'Browse', path: '/browse' }
        ])
    });

    return (
        <>
            <SEOHead {...browseSEO} />
            <Home />
        </>
    );
};

export default Browse;
