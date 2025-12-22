import React from 'react';
import '../styles/Footer.css';

const Footer = () => {
    return (
        <footer className="footer">
            <div className="container footer-content">
                <div className="footer-section">
                    <h3>Bylot</h3>
                    <p>Reducing losses from expiring goods.</p>
                    <p style={{ marginTop: '0.5rem', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                        <strong>CEO:</strong> Nagarjuna B V
                    </p>
                </div>
                <div className="footer-section">
                    <h4>Quick Links</h4>
                    <a href="#">About Us</a>
                    <a href="#">Contact</a>
                    <a href="#">Terms</a>
                </div>
                <div className="footer-section">
                    <h4>Contact</h4>
                    <p>nxtcmds@gmail.com</p>
                    <p>+91 8807974014</p>
                </div>
            </div>
            <div className="footer-bottom">
                <p>&copy; {new Date().getFullYear()} Bylot. All rights reserved.</p>
            </div>
        </footer>
    );
};

export default Footer;
