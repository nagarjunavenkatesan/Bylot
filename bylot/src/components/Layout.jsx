import React from 'react';
import Header from './Header';
import Footer from './Footer';

const Layout = ({ children, theme, toggleTheme }) => {
    return (
        <div className="layout">
            <Header theme={theme} toggleTheme={toggleTheme} />
            <main className="main-content">
                {children}
            </main>
            <Footer />
        </div>
    );
};

export default Layout;
