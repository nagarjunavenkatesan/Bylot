import React from 'react';
import { Link } from 'react-router-dom';
import '../styles/Footer.css';

const Footer = () => {
    return (
        <footer className="footer">
            <div className="container footer-content" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '2rem', padding: '3rem 1rem 2rem' }}>
                <div className="footer-section">
                    <h3>Bylot</h3>
                    <p style={{ marginTop: '0.5rem', lineHeight: '1.5' }}>
                        India's hyperlocal marketplace for near-expiry, surplus, and discounted goods. Save up to 70% while reducing food waste.
                    </p>
                    <p style={{ marginTop: '0.75rem', fontSize: '0.88rem', color: 'var(--text-muted)' }}>
                        <strong>Founder:</strong> Nagarjuna B V
                    </p>
                </div>

                <div className="footer-section">
                    <h4>Top Categories</h4>
                    <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: '0.4rem' }}>
                        <li><Link to="/category/groceries" style={{ color: 'inherit', textDecoration: 'none' }}>Daily Essentials</Link></li>
                        <li><Link to="/category/dairy" style={{ color: 'inherit', textDecoration: 'none' }}>Dairy Products</Link></li>
                        <li><Link to="/category/vegetables" style={{ color: 'inherit', textDecoration: 'none' }}>Fresh Vegetables</Link></li>
                        <li><Link to="/category/fruits" style={{ color: 'inherit', textDecoration: 'none' }}>Fresh Fruits</Link></li>
                        <li><Link to="/category/bakery" style={{ color: 'inherit', textDecoration: 'none' }}>Bakery &amp; Snacks</Link></li>
                        <li><Link to="/category/near-expiry" style={{ color: 'inherit', textDecoration: 'none' }}>Near Expiry Deals</Link></li>
                    </ul>
                </div>

                <div className="footer-section">
                    <h4>Hyperlocal Locations</h4>
                    <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: '0.4rem' }}>
                        <li><Link to="/location/bengaluru" style={{ color: 'inherit', textDecoration: 'none' }}>Bengaluru Stores</Link></li>
                        <li><Link to="/location/chennai" style={{ color: 'inherit', textDecoration: 'none' }}>Chennai Stores</Link></li>
                        <li><Link to="/location/coimbatore" style={{ color: 'inherit', textDecoration: 'none' }}>Coimbatore Stores</Link></li>
                        <li><Link to="/location/trichy" style={{ color: 'inherit', textDecoration: 'none' }}>Trichy Stores</Link></li>
                    </ul>
                </div>

                <div className="footer-section">
                    <h4>Company &amp; Support</h4>
                    <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: '0.4rem' }}>
                        <li><Link to="/about" style={{ color: 'inherit', textDecoration: 'none' }}>About Us</Link></li>
                        <li><Link to="/faq" style={{ color: 'inherit', textDecoration: 'none' }}>FAQ &amp; Help</Link></li>
                        <li><Link to="/contact" style={{ color: 'inherit', textDecoration: 'none' }}>Contact Us</Link></li>
                        <li><Link to="/terms" style={{ color: 'inherit', textDecoration: 'none' }}>Terms of Service</Link></li>
                        <li><Link to="/privacy" style={{ color: 'inherit', textDecoration: 'none' }}>Privacy Policy</Link></li>
                    </ul>
                </div>
            </div>

            <div className="footer-bottom" style={{ borderTop: '1px solid var(--border)', padding: '1.5rem 1rem', textAlign: 'center', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                <p>&copy; {new Date().getFullYear()} Bylot. All rights reserved. Reducing food waste across India.</p>
            </div>
        </footer>
    );
};

export default Footer;
