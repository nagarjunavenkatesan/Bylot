import React from 'react';
import { Link } from 'react-router-dom';
import PageTransition from '../components/PageTransition';
import SEOHead from '../components/SEOHead';
import { pageSEO, breadcrumbSEO } from '../utils/seo';

const Privacy = () => {
    const seoProps = pageSEO({
        title: 'Privacy Policy – Data Protection & Security | Bylot',
        description: 'Read Bylot\'s privacy policy to understand how we collect, protect, and use user data safely on our hyperlocal marketplace.',
        path: '/privacy',
        keywords: 'Bylot privacy policy, data protection, user security',
        structuredData: breadcrumbSEO([
            { name: 'Home', path: '/' },
            { name: 'Privacy Policy', path: '/privacy' }
        ])
    });

    return (
        <PageTransition>
            <SEOHead {...seoProps} />
            <div className="container" style={{ padding: '3rem 1rem', maxWidth: '850px', minHeight: '80vh' }}>
                <nav aria-label="Breadcrumb" style={{ marginBottom: '1.5rem', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                    <Link to="/" style={{ color: 'var(--primary)', textDecoration: 'none' }}>Home</Link>
                    <span style={{ margin: '0 0.5rem' }}>/</span>
                    <span style={{ fontWeight: 600 }}>Privacy Policy</span>
                </nav>

                <h1 className="section-title" style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>
                    Privacy Policy
                </h1>
                <p style={{ color: 'var(--text-muted)', marginBottom: '2rem' }}>
                    Last updated: October 2026
                </p>

                <div className="card" style={{ padding: '2.5rem', borderRadius: '12px', lineHeight: '1.7' }}>
                    <h2 style={{ fontSize: '1.4rem', color: 'var(--primary)', marginBottom: '0.75rem' }}>1. Information We Collect</h2>
                    <p style={{ marginBottom: '1.5rem' }}>
                        Bylot collects minimal required information to deliver marketplace functionality, including user account credentials, contact information, location coordinates (with explicit permission), and transaction history.
                    </p>

                    <h2 style={{ fontSize: '1.4rem', color: 'var(--primary)', marginBottom: '0.75rem' }}>2. How We Use Information</h2>
                    <p style={{ marginBottom: '1.5rem' }}>
                        Your information is strictly used to match you with nearby stores, process marketplace orders, prevent fraudulent activity, and communicate essential order updates.
                    </p>

                    <h2 style={{ fontSize: '1.4rem', color: 'var(--primary)', marginBottom: '0.75rem' }}>3. Data Security &amp; Protection</h2>
                    <p style={{ marginBottom: '1.5rem' }}>
                        We employ enterprise-grade security controls including TLS encryption, hashed passwords (bcrypt), rate limiting, and secure authentication tokens to safeguard your account.
                    </p>

                    <h2 style={{ fontSize: '1.4rem', color: 'var(--primary)', marginBottom: '0.75rem' }}>4. Contact Us</h2>
                    <p>
                        For privacy inquiries or data requests, contact <strong>nagarjunavenkatesan@gmail.com</strong>.
                    </p>
                </div>
            </div>
        </PageTransition>
    );
};

export default Privacy;
