import React from 'react';
import '../styles/Loader.css';

const Loader = () => {
    return (
        <div className="loader-container">
            <div className="cart-loader">
                <div className="cart-icon">🛒</div>
                <p>Loading your items...</p>
            </div>
        </div>
    );
};

export default Loader;
