import React from 'react';
import { Link } from 'react-router-dom';
import PageTransition from '../components/PageTransition';
import SEOHead from '../components/SEOHead';
import { pageSEO, breadcrumbSEO, faqSEO } from '../utils/seo';

const FAQS_DATA = [
    {
        question: 'What is Bylot?',
        answer: 'Bylot is India\'s hyperlocal marketplace connecting local store owners with nearby consumers to buy fresh produce, provisions, bakery, and daily essentials approaching their shelf-life expiry at discounts up to 70% off.'
    },
    {
        question: 'Are near-expiry products safe to consume?',
        answer: 'Yes. All products listed on Bylot are verified items within their legal and safe consumption dates. Stores publish items prior to expiry so consumers can use them immediately.'
    },
    {
        question: 'How much can I save on Bylot?',
        answer: 'Shoppers save anywhere between 30% to 70% off standard retail MRP on daily groceries, dairy, snacks, and corporate clearance stock.'
    },
    {
        question: 'How do local sellers list items on Bylot?',
        answer: 'Verified local store owners and distributors register as sellers on Bylot, upload their surplus or near-expiry inventory details, set discounted pricing, and receive orders from nearby shoppers.'
    },
    {
        question: 'Which cities does Bylot currently operate in?',
        answer: 'Bylot currently serves key South Indian hubs including Bengaluru, Chennai, Coimbatore, and Trichy, with expanding hyperlocal coverage.'
    }
];

const FAQ = () => {
    const seoProps = pageSEO({
        title: 'Frequently Asked Questions (FAQ) – Bylot Hyperlocal Deals',
        description: 'Find answers to common questions about buying near-expiry groceries, seller onboarding, safety standards, and saving up to 70% on Bylot.',
        path: '/faq',
        keywords: 'Bylot FAQ, near expiry food safety, discounted groceries FAQ, hyperlocal marketplace questions',
        structuredData: [
            breadcrumbSEO([
                { name: 'Home', path: '/' },
                { name: 'FAQ', path: '/faq' }
            ]),
            faqSEO(FAQS_DATA)
        ]
    });

    return (
        <PageTransition>
            <SEOHead {...seoProps} />
            <div className="container" style={{ padding: '3rem 1rem', maxWidth: '850px', minHeight: '80vh' }}>
                <nav aria-label="Breadcrumb" style={{ marginBottom: '1.5rem', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                    <Link to="/" style={{ color: 'var(--primary)', textDecoration: 'none' }}>Home</Link>
                    <span style={{ margin: '0 0.5rem' }}>/</span>
                    <span style={{ fontWeight: 600 }}>FAQ</span>
                </nav>

                <h1 className="section-title" style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>
                    Frequently Asked Questions
                </h1>
                <p style={{ color: 'var(--text-muted)', fontSize: '1.05rem', marginBottom: '2rem' }}>
                    Everything you need to know about buying discounted near-expiry products and selling surplus goods on Bylot.
                </p>

                <div style={{ display: 'grid', gap: '1.25rem' }}>
                    {FAQS_DATA.map((faq, index) => (
                        <div key={index} className="card" style={{ padding: '1.75rem', borderRadius: '12px' }}>
                            <h2 style={{ fontSize: '1.2rem', color: 'var(--primary)', marginBottom: '0.5rem' }}>
                                {faq.question}
                            </h2>
                            <p style={{ color: 'var(--text-main)', lineHeight: '1.6' }}>
                                {faq.answer}
                            </p>
                        </div>
                    ))}
                </div>

                <div style={{ marginTop: '2.5rem', textAlign: 'center', padding: '2rem', backgroundColor: 'rgba(99, 102, 241, 0.05)', borderRadius: '12px' }}>
                    <h3>Still have questions?</h3>
                    <p style={{ color: 'var(--text-muted)', marginTop: '0.5rem', marginBottom: '1rem' }}>
                        Our support team is ready to assist you.
                    </p>
                    <Link to="/contact" className="btn btn-primary">Contact Support</Link>
                </div>
            </div>
        </PageTransition>
    );
};

export default FAQ;
