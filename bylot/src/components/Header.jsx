import React, { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import '../styles/Header.css';
import { useAuth } from '../context/AuthContext';
import { apiRequest } from '../api/backendApi';

const Header = ({ theme, toggleTheme }) => {
    const [isMenuOpen, setIsMenuOpen] = React.useState(false);
    const [sellerApproved, setSellerApproved] = React.useState(false);
    const { user } = useAuth();
    const navRef = useRef(null);

    const toggleMenu = () => {
        setIsMenuOpen(!isMenuOpen);
    };

    useEffect(() => {
        let cancelled = false;
        if (user) {
            apiRequest('/api/sellers/profile')
                .then(res => {
                    if (!cancelled) setSellerApproved(res?.data?.approval_status === 'approved');
                })
                .catch(() => {
                    if (!cancelled) setSellerApproved(false);
                });
        }
        return () => {
            cancelled = true;
            setSellerApproved(false);
        };
    }, [user]);

    useEffect(() => {
        if (!isMenuOpen) return undefined;
        const onKey = (e) => {
            if (e.key === 'Escape') setIsMenuOpen(false);
        };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [isMenuOpen]);

    return (
        <header className="header">
            {isMenuOpen && (
                <button
                    type="button"
                    className="nav-overlay"
                    aria-label="Close menu"
                    onClick={() => setIsMenuOpen(false)}
                />
            )}
            <div className="container header-content">
                <div className="logo">
                    <Link to="/" style={{ textDecoration: 'none' }}>
                        <h1>Bylot</h1>
                    </Link>
                </div>

                <button className="mobile-menu-btn" onClick={toggleMenu} aria-label="Toggle Menu">
                    <span className={`hamburger ${isMenuOpen ? 'open' : ''}`}></span>
                </button>

                <nav ref={navRef} className={`nav ${isMenuOpen ? 'nav-open' : ''}`} id="main-nav">
                    <Link to="/" className="nav-link" onClick={() => setIsMenuOpen(false)}>Home</Link>
                    <Link to="/about" className="nav-link" onClick={() => setIsMenuOpen(false)}>About Us</Link>
                    <Link to={user ? "/sell" : "/login"} className="nav-link" onClick={() => setIsMenuOpen(false)}>Sell</Link>
                    {sellerApproved && (
                        <Link to="/seller/orders" className="nav-link" onClick={() => setIsMenuOpen(false)}>Seller orders</Link>
                    )}
                    {user?.role === 'admin' && (
                        <Link to="/admin" className="nav-link" style={{ color: 'var(--primary)', fontWeight: '700' }} onClick={() => setIsMenuOpen(false)}>Admin Panel</Link>
                    )}
                    <div className="google-skill-chip green" style={{ padding: '0.4rem 0.8rem', fontSize: '0.75rem', cursor: 'pointer' }}>
                        🌱 Bylot Eco Level
                    </div>
                    <button onClick={toggleTheme} className="theme-toggle" aria-label="Toggle Theme">
                        {theme === 'light' ? '🌙' : '☀️'}
                    </button>
                    {user ? (
                        <Link to="/profile" className="btn btn-secondary btn-sm" style={{ textDecoration: 'none' }} onClick={() => setIsMenuOpen(false)}>Profile</Link>
                    ) : (
                        <Link to="/login" className="btn btn-primary btn-sm" style={{ textDecoration: 'none' }} onClick={() => setIsMenuOpen(false)}>Login</Link>
                    )}
                </nav>
            </div>
        </header>
    );
};

export default Header;
