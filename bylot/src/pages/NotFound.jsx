import React from 'react';
import { Link } from 'react-router-dom';
import PageTransition from '../components/PageTransition';
import SEOHead from '../components/SEOHead';
import { pageSEO } from '../utils/seo';

const NotFound = () => {
    const currentPath = typeof window !== 'undefined' ? window.location.pathname : '/404';
    const seoProps = pageSEO({
        title: '404 - Page Not Found | Bylot',
        description: 'The requested page could not be found. Browse discounted groceries, near-expiry deals, and hyperlocal items on Bylot.',
        path: currentPath,
        noindex: true,
        robots: 'noindex, nofollow',
    });

    return (
        <PageTransition>
            <SEOHead {...seoProps} />
            <div className="container" style={{ padding: '4rem 1rem', textAlign: 'center', minHeight: '75vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
                <div style={{ fontSize: '5rem', fontWeight: 900, color: 'var(--primary)', lineHeight: 1 }}>404</div>
                <h1 className="section-title" style={{ fontSize: '2rem', marginTop: '1rem', marginBottom: '0.5rem' }}>
                    Page Not Found
                </h1>
                <p style={{ color: 'var(--text-muted)', fontSize: '1.05rem', maxWidth: '500px', marginBottom: '2rem' }}>
                    Sorry, the page you are looking for does not exist, has been removed, or the link may be broken.
                </p>

                <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', justifyContent: 'center' }}>
                    <Link to="/" className="btn btn-primary">Return Home</Link>
                    <Link to="/browse" className="btn btn-outline">Browse All Deals</Link>
                </div>

                <div style={{ marginTop: '3rem', borderTop: '1px solid var(--border)', paddingTop: '2rem', maxWidth: '600px', width: '100%' }}>
                    <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem' }}>Popular Categories</h3>
                    <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', justifyContent: 'center' }}>
                        <Link to="/category/groceries" className="btn btn-secondary btn-sm">Daily Essentials</Link>
                        <Link to="/category/dairy" className="btn btn-secondary btn-sm">Dairy</Link>
                        <Link to="/category/vegetables" className="btn btn-secondary btn-sm">Vegetables</Link>
                        <Link to="/category/bakery" className="btn btn-secondary btn-sm">Bakery</Link>
                        <Link to="/category/near-expiry" className="btn btn-secondary btn-sm">Near Expiry</Link>
                    </div>
                </div>
            </div>
        </PageTransition>
    );
};

export default NotFound;
