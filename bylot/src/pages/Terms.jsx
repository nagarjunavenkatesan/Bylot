import React from 'react';
import { Link } from 'react-router-dom';
import PageTransition from '../components/PageTransition';
import SEOHead from '../components/SEOHead';
import { pageSEO, breadcrumbSEO } from '../utils/seo';

const Terms = () => {
    const seoProps = pageSEO({
        title: 'Terms of Service & Marketplace Guidelines – Bylot',
        description: 'Read the terms of service, marketplace guidelines, buyer protections, and seller obligations on Bylot.',
        path: '/terms',
        keywords: 'Bylot terms, marketplace guidelines, near expiry food policy, seller terms',
        structuredData: breadcrumbSEO([
            { name: 'Home', path: '/' },
            { name: 'Terms of Service', path: '/terms' }
        ])
    });

    return (
        <PageTransition>
            <SEOHead {...seoProps} />
            <div className="container" style={{ padding: '3rem 1rem', maxWidth: '850px', minHeight: '80vh' }}>
                <nav aria-label="Breadcrumb" style={{ marginBottom: '1.5rem', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                    <Link to="/" style={{ color: 'var(--primary)', textDecoration: 'none' }}>Home</Link>
                    <span style={{ margin: '0 0.5rem' }}>/</span>
                    <span style={{ fontWeight: 600 }}>Terms of Service</span>
                </nav>

                <h1 className="section-title" style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>
                    Terms of Service
                </h1>
                <p style={{ color: 'var(--text-muted)', marginBottom: '2rem' }}>
                    Last updated: October 2026
                </p>

                <div className="card" style={{ padding: '2.5rem', borderRadius: '12px', lineHeight: '1.7' }}>
                    <h2 style={{ fontSize: '1.4rem', color: 'var(--primary)', marginBottom: '0.75rem' }}>1. Acceptance of Terms</h2>
                    <p style={{ marginBottom: '1.5rem' }}>
                        By accessing or using the Bylot platform (website, application, and associated services), you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use our services.
                    </p>

                    <h2 style={{ fontSize: '1.4rem', color: 'var(--primary)', marginBottom: '0.75rem' }}>2. Marketplace Model &amp; Listings</h2>
                    <p style={{ marginBottom: '1.5rem' }}>
                        Bylot provides a hyperlocal marketplace connecting local merchants and buyers. Merchants are solely responsible for ensuring that all published near-expiry, surplus, or discounted food products comply with local food safety laws, accurate labeling, and true expiration date disclosures.
                    </p>

                    <h2 style={{ fontSize: '1.4rem', color: 'var(--primary)', marginBottom: '0.75rem' }}>3. Product Safety &amp; Expiry Disclosures</h2>
                    <p style={{ marginBottom: '1.5rem' }}>
                        All items listed under "Near Expiry" must be genuine, uncompromised, and within their safe consumption window. Expired products or items unfit for human consumption are strictly prohibited on Bylot.
                    </p>

                    <h2 style={{ fontSize: '1.4rem', color: 'var(--primary)', marginBottom: '0.75rem' }}>4. Buyer Responsibilities</h2>
                    <p style={{ marginBottom: '1.5rem' }}>
                        Buyers are responsible for inspecting products upon collection or delivery and storing items in accordance with handling instructions.
                    </p>

                    <h2 style={{ fontSize: '1.4rem', color: 'var(--primary)', marginBottom: '0.75rem' }}>5. Contact &amp; Inquiries</h2>
                    <p>
                        For questions regarding these terms, contact us at <strong>nagarjunavenkatesan@gmail.com</strong>.
                    </p>
                </div>
            </div>
        </PageTransition>
    );
};

export default Terms;
