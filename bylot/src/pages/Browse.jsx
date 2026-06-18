import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import ProductCard from '../components/ProductCard';
import PageTransition from '../components/PageTransition';
import Loader from '../components/Loader';
import { fetchProducts as fetchBackendProducts, fetchNearbyProducts, adminDeleteProduct } from '../api/backendApi';
import { useAuth } from '../context/AuthContext';
import { useLocation, PRESET_CITIES } from '../context/LocationContext';
import '../styles/Browse.css';

const Browse = () => {
    const { user } = useAuth();
    const isAdmin = user?.role === 'admin';

    const { coords, status: locationStatus, loading: locationLoading, requestLocation, setManualLocation } = useLocation();

    const [searchQuery, setSearchQuery]       = useState('');
    const [selectedCategory, setSelectedCategory] = useState('All');
    const [maxDistance, setMaxDistance]       = useState(15);
    const [products, setProducts]             = useState([]);
    const [loadingProducts, setLoadingProducts] = useState(true);
    const [fetchError, setFetchError]         = useState(null);
    const [showCityPicker, setShowCityPicker] = useState(false);

    const categories = ['All', 'Dairy', 'Vegetables', 'Fruits', 'Bakery'];

    // Load products — always loads regardless of location status
    useEffect(() => {
        if (locationLoading) return; // wait only until location check is done (fast)

        const load = async () => {
            setLoadingProducts(true);
            setFetchError(null);
            try {
                let data = [];
                if (coords) {
                    data = await fetchNearbyProducts(coords.latitude, coords.longitude, maxDistance);
                } else {
                    // No location — load all products normally
                    data = await fetchBackendProducts();
                }
                if (coords) {
                    data.sort((a, b) => (a.distance ?? Infinity) - (b.distance ?? Infinity));
                }
                setProducts(data);
            } catch (err) {
                setFetchError(err.message);
            } finally {
                setLoadingProducts(false);
            }
        };

        load();
    }, [coords, maxDistance, locationLoading]);

    const handleAdminDelete = async (productId) => {
        if (!window.confirm('Delete this product?')) return;
        try {
            await adminDeleteProduct(productId);
            setProducts(prev => prev.filter(p => p.id !== productId));
        } catch (err) {
            alert(`Failed to delete: ${err.message}`);
        }
    };

    const filteredProducts = products.filter(product => {
        const matchesSearch   = product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                product.category.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesCategory = selectedCategory === 'All' || product.category === selectedCategory;
        const matchesDistance = !coords || product.distance == null || (product.distance <= maxDistance);
        return matchesSearch && matchesCategory && matchesDistance;
    });

    return (
        <PageTransition>
            <div className="browse-page container">

                {/* ── Location bar ───────────────────────────────────────── */}
                <div className="location-bar">
                    {locationLoading ? (
                        <span className="loc-chip loc-chip--loading">🔄 Detecting location…</span>
                    ) : coords ? (
                        <span className="loc-chip loc-chip--active">
                            📡 {locationStatus === 'manual' ? 'City set' : 'GPS active'}
                            <button className="loc-chip-btn" onClick={requestLocation}>Refresh</button>
                        </span>
                    ) : (
                        <span className="loc-chip loc-chip--off">
                            📍 No location
                            <button className="loc-chip-btn" onClick={requestLocation}>Enable GPS</button>
                            <button className="loc-chip-btn" onClick={() => setShowCityPicker(p => !p)}>Pick city</button>
                        </span>
                    )}
                </div>

                {/* ── City picker dropdown ───────────────────────────────── */}
                {showCityPicker && (
                    <div className="city-picker">
                        {PRESET_CITIES.map(city => (
                            <button key={city.name} className="city-pill"
                                onClick={() => { setManualLocation(city); setShowCityPicker(false); }}>
                                {city.name}
                            </button>
                        ))}
                    </div>
                )}

                <div className="browse-header">
                    <h2>Browse Deals</h2>

                    {isAdmin && (
                        <div className="admin-mode-badge">🛡️ Admin Mode — Delete any listing</div>
                    )}

                    {/* Filter Bar */}
                    <div className="filter-bar">
                        <div className="filter-item search-container">
                            <span className="search-icon">🔍</span>
                            <input type="text" placeholder="Search products…" value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)} className="search-input" />
                        </div>

                        <div className="filter-item category-container">
                            <span className="filter-icon">⚡</span>
                            <select value={selectedCategory} onChange={e => setSelectedCategory(e.target.value)} className="category-select">
                                {categories.map(cat => <option key={cat}>{cat}</option>)}
                            </select>
                        </div>

                        {coords && (
                            <div className="filter-item distance-container">
                                <div className="distance-label">
                                    <span className="location-icon">📍</span>
                                    <span>Distance</span>
                                </div>
                                <div className="slider-wrapper">
                                    <input type="range" min="1" max="50" value={maxDistance}
                                        onChange={e => setMaxDistance(Number(e.target.value))} className="distance-slider"
                                        style={{ background: `linear-gradient(to right,#6366f1 0%,#ec4899 ${(maxDistance/50)*100}%,#e2e8f0 ${(maxDistance/50)*100}%,#e2e8f0 100%)` }} />
                                    <span className="distance-value">{maxDistance} km</span>
                                </div>
                            </div>
                        )}

                        <button className="location-btn" onClick={requestLocation} disabled={locationLoading}>
                            <span className="target-icon">⌖</span>
                            {locationLoading ? 'Locating…' : 'GPS'}
                        </button>
                    </div>
                </div>

                {/* Products */}
                {loadingProducts ? (
                    <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}>
                        <Loader />
                    </div>
                ) : fetchError ? (
                    <div className="fetch-error-banner">
                        <span className="fetch-error-icon">⚠️</span>
                        <div className="fetch-error-body">
                            <strong>Couldn't load products</strong>
                            <p>{fetchError}</p>
                        </div>
                        <button className="btn btn-primary" onClick={() => window.location.reload()}>Retry</button>
                    </div>
                ) : (
                    <motion.div className="listings-grid"
                        variants={{ hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.05 } } }}
                        initial="hidden" animate="visible">
                        {filteredProducts.length > 0 ? (
                            filteredProducts.map(item => (
                                <motion.div key={item.id} variants={{ hidden: { opacity: 0, y: 15 }, visible: { opacity: 1, y: 0 } }}>
                                    <ProductCard product={item} isAdmin={isAdmin} onAdminDelete={handleAdminDelete} />
                                </motion.div>
                            ))
                        ) : (
                            <div style={{ width: '100%', gridColumn: '1 / -1', textAlign: 'center', padding: '4rem' }}>
                                <p style={{ fontSize: '1.2rem', color: 'var(--text-muted)' }}>No products found.</p>
                                <button onClick={() => { setSearchQuery(''); setSelectedCategory('All'); setMaxDistance(50); }}
                                    style={{ color: 'var(--primary)', cursor: 'pointer', background: 'none', border: 'none', textDecoration: 'underline', marginTop: '1rem', fontSize: '1rem' }}>
                                    Clear filters
                                </button>
                            </div>
                        )}
                    </motion.div>
                )}
            </div>
        </PageTransition>
    );
};

export default Browse;
