import React from 'react';
import { Link } from 'react-router-dom';
import PageTransition from '../components/PageTransition';
import SEOHead from '../components/SEOHead';
import { pageSEO, breadcrumbSEO, ORGANISATION_SD } from '../utils/seo';

const About = () => {
    const seoProps = pageSEO({
        title: 'About Bylot – Hyperlocal Food Waste Reduction & Surplus Marketplace',
        description: 'Learn about Bylot, India\'s hyperlocal marketplace dedicated to reducing losses from expiring goods and connecting local stores with nearby buyers for up to 70% off.',
        path: '/about',
        keywords: 'about Bylot, food waste reduction India, hyperlocal marketplace mission, surplus groceries, discounted food app',
        structuredData: [
            breadcrumbSEO([
                { name: 'Home', path: '/' },
                { name: 'About Us', path: '/about' }
            ]),
            ORGANISATION_SD
        ]
    });

    return (
        <PageTransition>
            <SEOHead {...seoProps} />
            <div className="container" style={{ padding: '3rem 1rem', maxWidth: '900px', minHeight: '80vh' }}>
                <nav aria-label="Breadcrumb" style={{ marginBottom: '1.5rem', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                    <Link to="/" style={{ color: 'var(--primary)', textDecoration: 'none' }}>Home</Link>
                    <span style={{ margin: '0 0.5rem' }}>/</span>
                    <span style={{ fontWeight: 600 }}>About Us</span>
                </nav>

                <h1 className="section-title" style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>
                    About Bylot
                </h1>
                <p style={{ fontSize: '1.2rem', color: 'var(--text-muted)', marginBottom: '2rem', lineHeight: '1.6' }}>
                    Connecting local retailers with nearby buyers to eliminate food waste and unlock up to 70% savings on daily essentials.
                </p>

                <div className="card" style={{ padding: '2rem', marginBottom: '2rem', borderRadius: '12px' }}>
                    <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem', color: 'var(--primary)' }}>Our Mission</h2>
                    <p style={{ lineHeight: '1.7', color: 'var(--text-main)', marginBottom: '1rem' }}>
                        Every year, tons of perfectly safe, high-quality groceries and consumables are discarded simply because they are approaching their shelf-life expiry. At the same time, local neighborhood stores suffer inventory losses, while consumers look for ways to reduce household grocery spending.
                    </p>
                    <p style={{ lineHeight: '1.7', color: 'var(--text-main)' }}>
                        <strong>Bylot</strong> bridges this gap through an enterprise-grade, real-time hyperlocal marketplace. By allowing verified merchants to publish surplus and near-expiry inventory at steep discounts, we enable consumers to buy fresh goods at fraction of MRP while helping local businesses recover margin.
                    </p>
                </div>

                <div className="card" style={{ padding: '2rem', marginBottom: '2rem', borderRadius: '12px' }}>
                    <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem', color: 'var(--primary)' }}>How Bylot Works</h2>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.5rem', marginTop: '1rem' }}>
                        <div>
                            <h3>1. Hyperlocal Discovery</h3>
                            <p style={{ fontSize: '0.95rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                                Find near-expiry produce, dairy, bakery items, and provisions listed by local vendors within your radius.
                            </p>
                        </div>
                        <div>
                            <h3>2. Deep Discounts</h3>
                            <p style={{ fontSize: '0.95rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                                Save 30% to 70% off standard MRP on items that are fully safe and ready for prompt consumption.
                            </p>
                        </div>
                        <div>
                            <h3>3. Verified Quality</h3>
                            <p style={{ fontSize: '0.95rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                                Transparent expiry dates, item details, and verified store locations ensure complete trust.
                            </p>
                        </div>
                    </div>
                </div>

                <div className="card" style={{ padding: '2rem', borderRadius: '12px' }}>
                    <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem', color: 'var(--primary)' }}>Leadership &amp; Identity</h2>
                    <p style={{ lineHeight: '1.7', color: 'var(--text-main)' }}>
                        Founded by <strong>Nagarjuna B V</strong>, Bylot operates as an independent, technology-driven marketplace platform headquartered in India, supporting sustainable urban consumption and circular commerce.
                    </p>
                </div>
            </div>
        </PageTransition>
    );
};

export default About;
