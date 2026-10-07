import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import PageTransition from '../components/PageTransition';
import SEOHead from '../components/SEOHead';
import { pageSEO, breadcrumbSEO } from '../utils/seo';

const Contact = () => {
    const [submitted, setSubmitted] = useState(false);
    const [formData, setFormData] = useState({ name: '', email: '', subject: '', message: '' });

    const seoProps = pageSEO({
        title: 'Contact Bylot – Support & Seller Inquiries',
        description: 'Get in touch with the Bylot support team. Have questions about buying near-expiry goods or listing surplus stock as a seller? We are here to help.',
        path: '/contact',
        keywords: 'contact Bylot, Bylot support, seller onboarding, food waste marketplace help',
        structuredData: breadcrumbSEO([
            { name: 'Home', path: '/' },
            { name: 'Contact Us', path: '/contact' }
        ])
    });

    const handleSubmit = (e) => {
        e.preventDefault();
        setSubmitted(true);
    };

    return (
        <PageTransition>
            <SEOHead {...seoProps} />
            <div className="container" style={{ padding: '3rem 1rem', maxWidth: '800px', minHeight: '80vh' }}>
                <nav aria-label="Breadcrumb" style={{ marginBottom: '1.5rem', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                    <Link to="/" style={{ color: 'var(--primary)', textDecoration: 'none' }}>Home</Link>
                    <span style={{ margin: '0 0.5rem' }}>/</span>
                    <span style={{ fontWeight: 600 }}>Contact Us</span>
                </nav>

                <h1 className="section-title" style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>
                    Contact Us
                </h1>
                <p style={{ color: 'var(--text-muted)', fontSize: '1.05rem', marginBottom: '2rem' }}>
                    Have a question, feedback, or interest in onboarding your store to Bylot? Reach out to our team.
                </p>

                <div className="card" style={{ padding: '2.5rem', borderRadius: '12px' }}>
                    {submitted ? (
                        <div style={{ textAlign: 'center', padding: '2rem 0' }}>
                            <h2 style={{ color: 'var(--primary)', marginBottom: '0.75rem' }}>Thank You!</h2>
                            <p style={{ color: 'var(--text-muted)' }}>
                                Your message has been received. Our team will get back to you shortly at {formData.email}.
                            </p>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '1.25rem' }}>
                            <div>
                                <label style={{ display: 'block', marginBottom: '0.4rem', fontWeight: 600 }}>Full Name</label>
                                <input
                                    type="text"
                                    required
                                    className="form-input"
                                    placeholder="Enter your name"
                                    value={formData.name}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                />
                            </div>
                            <div>
                                <label style={{ display: 'block', marginBottom: '0.4rem', fontWeight: 600 }}>Email Address</label>
                                <input
                                    type="email"
                                    required
                                    className="form-input"
                                    placeholder="name@example.com"
                                    value={formData.email}
                                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                                />
                            </div>
                            <div>
                                <label style={{ display: 'block', marginBottom: '0.4rem', fontWeight: 600 }}>Subject</label>
                                <input
                                    type="text"
                                    required
                                    className="form-input"
                                    placeholder="Order inquiry, Seller onboarding, etc."
                                    value={formData.subject}
                                    onChange={e => setFormData({ ...formData, subject: e.target.value })}
                                />
                            </div>
                            <div>
                                <label style={{ display: 'block', marginBottom: '0.4rem', fontWeight: 600 }}>Message</label>
                                <textarea
                                    required
                                    rows="5"
                                    className="form-input"
                                    placeholder="Write your message here..."
                                    value={formData.message}
                                    onChange={e => setFormData({ ...formData, message: e.target.value })}
                                />
                            </div>
                            <button type="submit" className="btn btn-primary" style={{ padding: '0.85rem', fontWeight: 700 }}>
                                Send Message
                            </button>
                        </form>
                    )}
                </div>

                <div style={{ marginTop: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.95rem' }}>
                    <p>Direct Email Support: <strong>nagarjunavenkatesan@gmail.com</strong></p>
                </div>
            </div>
        </PageTransition>
    );
};

export default Contact;
