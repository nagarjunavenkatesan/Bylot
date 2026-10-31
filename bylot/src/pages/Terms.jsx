import React from 'react';
import { Link } from 'react-router-dom';
import PageTransition from '../components/PageTransition';
import SEOHead from '../components/SEOHead';
import { pageSEO, breadcrumbSEO } from '../utils/seo';

const Terms = () => {
    const seoProps = pageSEO({
        title: 'Terms & Conditions',
        description: 'Read the Terms & Conditions governing the use of Bylot, a hyperlocal marketplace connecting buyers and sellers.',
        path: '/terms',
        structuredData: breadcrumbSEO([
            { name: 'Home', path: '/' },
            { name: 'Terms & Conditions', path: '/terms' }
        ])
    });

    return (
        <PageTransition>
            <SEOHead {...seoProps} />
            <div className="container" style={{ padding: '3rem 1rem', maxWidth: '850px', minHeight: '80vh' }}>
                <nav aria-label="Breadcrumb" style={{ marginBottom: '1.5rem', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                    <Link to="/" style={{ color: 'var(--primary)', textDecoration: 'none' }}>Home</Link>
                    <span style={{ margin: '0 0.5rem' }}>/</span>
                    <span style={{ fontWeight: 600 }}>Terms &amp; Conditions</span>
                </nav>

                <h1 className="section-title" style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>
                    Terms &amp; Conditions
                </h1>
                <p style={{ color: 'var(--text-muted)', marginBottom: '2rem', fontWeight: 600 }}>
                    Last Updated: 30 October 2026
                </p>

                <div
                    className="card"
                    style={{
                        padding: 'clamp(1.5rem, 4vw, 2.5rem)',
                        borderRadius: '12px',
                        lineHeight: '1.7',
                        background: 'var(--bg-surface)',
                        border: '1px solid var(--border)'
                    }}
                >
                    <p style={{ marginBottom: '1rem' }}>
                        Welcome to <strong>Bylot</strong>, a hyperlocal marketplace that connects buyers and sellers.
                    </p>
                    <p style={{ marginBottom: '1.5rem' }}>
                        By accessing or using Bylot, you agree to the following terms:
                    </p>

                    <h2 style={{ fontSize: '1.35rem', color: 'var(--primary)', marginBottom: '0.75rem', marginTop: '1.5rem' }}>
                        1. Use of Bylot
                    </h2>
                    <p style={{ marginBottom: '1.5rem' }}>
                        You must provide accurate information and use Bylot only for lawful purposes. You are responsible for your account and activity on the Platform.
                    </p>

                    <h2 style={{ fontSize: '1.35rem', color: 'var(--primary)', marginBottom: '0.75rem', marginTop: '1.5rem' }}>
                        2. Sellers
                    </h2>
                    <p style={{ marginBottom: '1.5rem' }}>
                        Sellers are responsible for the accuracy, legality, condition, availability, and ownership of the products they list.
                    </p>

                    <h2 style={{ fontSize: '1.35rem', color: 'var(--primary)', marginBottom: '0.75rem', marginTop: '1.5rem' }}>
                        3. Buyers
                    </h2>
                    <p style={{ marginBottom: '1.5rem' }}>
                        Buyers should verify product details, seller information, price, condition, and availability before completing any transaction.
                    </p>

                    <h2 style={{ fontSize: '1.35rem', color: 'var(--primary)', marginBottom: '0.75rem', marginTop: '1.5rem' }}>
                        4. Transactions
                    </h2>
                    <p style={{ marginBottom: '1.5rem' }}>
                        Bylot connects buyers and sellers but <strong>does not currently process payments</strong> between users. Transactions, payments, delivery, and pickup arrangements are the responsibility of the parties involved.
                    </p>

                    <h2 style={{ fontSize: '1.35rem', color: 'var(--primary)', marginBottom: '0.75rem', marginTop: '1.5rem' }}>
                        5. Prohibited Content
                    </h2>
                    <p style={{ marginBottom: '1.5rem' }}>
                        Illegal, stolen, counterfeit, fraudulent, misleading, or otherwise prohibited products and content are not allowed.
                    </p>

                    <h2 style={{ fontSize: '1.35rem', color: 'var(--primary)', marginBottom: '0.75rem', marginTop: '1.5rem' }}>
                        6. Product Removal
                    </h2>
                    <p style={{ marginBottom: '1.5rem' }}>
                        Bylot may remove or restrict listings that violate these Terms or applicable laws. Sellers may delete their own listings where the feature is available. Certain records may be retained for security, legal, audit, and reporting purposes.
                    </p>

                    <h2 style={{ fontSize: '1.35rem', color: 'var(--primary)', marginBottom: '0.75rem', marginTop: '1.5rem' }}>
                        7. User Conduct
                    </h2>
                    <p style={{ marginBottom: '1.5rem' }}>
                        Users must not misuse the Platform, attempt unauthorized access, commit fraud, upload malicious content, or interfere with Bylot's systems or security.
                    </p>

                    <h2 style={{ fontSize: '1.35rem', color: 'var(--primary)', marginBottom: '0.75rem', marginTop: '1.5rem' }}>
                        8. Privacy
                    </h2>
                    <p style={{ marginBottom: '1.5rem' }}>
                        Your use of Bylot is also governed by our{' '}
                        <Link to="/privacy" style={{ color: 'var(--primary)', fontWeight: 600, textDecoration: 'underline' }}>
                            Privacy Policy
                        </Link>
                        , which explains how your information is handled.
                    </p>

                    <h2 style={{ fontSize: '1.35rem', color: 'var(--primary)', marginBottom: '0.75rem', marginTop: '1.5rem' }}>
                        9. Platform Availability
                    </h2>
                    <p style={{ marginBottom: '1.5rem' }}>
                        We work to keep Bylot reliable, but we do not guarantee uninterrupted or error-free service.
                    </p>

                    <h2 style={{ fontSize: '1.35rem', color: 'var(--primary)', marginBottom: '0.75rem', marginTop: '1.5rem' }}>
                        10. Changes
                    </h2>
                    <p style={{ marginBottom: '1.5rem' }}>
                        We may update these Terms or Platform features from time to time. Updated Terms will be published on this page.
                    </p>

                    <h2 style={{ fontSize: '1.35rem', color: 'var(--primary)', marginBottom: '0.75rem', marginTop: '1.5rem' }}>
                        11. Governing Law
                    </h2>
                    <p style={{ marginBottom: '1.5rem' }}>
                        These Terms are governed by the laws of <strong>India</strong>, subject to applicable laws and legal rights.
                    </p>

                    <h2 style={{ fontSize: '1.35rem', color: 'var(--primary)', marginBottom: '0.75rem', marginTop: '1.5rem' }}>
                        12. Contact
                    </h2>
                    <p style={{ marginBottom: '2rem' }}>
                        For questions or concerns regarding these Terms, please contact us through the official contact information provided on Bylot.
                    </p>

                    <div style={{ paddingTop: '1.5rem', borderTop: '1px solid var(--border)' }}>
                        <p style={{ marginBottom: '0.75rem', fontWeight: 600 }}>
                            By using Bylot, you acknowledge that you have read and agreed to these Terms &amp; Conditions.
                        </p>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.92rem', fontWeight: 600 }}>
                            &copy; 2026 Bylot. All rights reserved.
                        </p>
                    </div>
                </div>
            </div>
        </PageTransition>
    );
};

export default Terms;
