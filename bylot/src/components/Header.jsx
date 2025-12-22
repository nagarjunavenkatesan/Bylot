import React from 'react';
import { Link } from 'react-router-dom';
import '../styles/Header.css';
import { useAuth } from '../context/AuthContext';

const Header = ({ theme, toggleTheme }) => {
    const [isMenuOpen, setIsMenuOpen] = React.useState(false);
    const { user } = useAuth();

    const toggleMenu = () => {
        setIsMenuOpen(!isMenuOpen);
    };

    return (
        <header className="header">
            <div className="container header-content">
                <div className="logo">
                    <Link to="/" style={{ textDecoration: 'none' }}>
                        <h1>Bylot</h1>
                    </Link>
                </div>

                <button className="mobile-menu-btn" onClick={toggleMenu} aria-label="Toggle Menu">
                    <span className={`hamburger ${isMenuOpen ? 'open' : ''}`}></span>
                </button>

                <nav className={`nav ${isMenuOpen ? 'nav-open' : ''}`}>
                    <Link to="/" className="nav-link" onClick={() => setIsMenuOpen(false)}>Home</Link>
                    <Link to="/browse" className="nav-link" onClick={() => setIsMenuOpen(false)}>Browse</Link>
                    <Link to="/sell" className="nav-link" onClick={() => setIsMenuOpen(false)}>Sell</Link>
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
