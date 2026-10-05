import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import Button from '../components/Button';
import Card from '../components/Card';
import ProductCard from '../components/ProductCard';
import PageTransition from '../components/PageTransition';
import Loader from '../components/Loader';
import { fetchProducts, fetchNearbyProducts, adminDeleteProduct } from '../api/backendApi';
import { useAuth } from '../context/AuthContext';
import { useLocation, PRESET_CITIES } from '../context/LocationContext';
import SEOHead from '../components/SEOHead';
import { pageSEO, itemListSEO } from '../utils/seo';
import '../styles/Home.css';
import '../styles/Browse.css';


const CATEGORIES = [
    'All',
    'Daily Essentials',
    'Near Expiry',
    'Discount Products',
    'Dairy',
    'Vegetables',
    'Fruits',
    'Bakery',
    'Corporate Clearance',
];

const SORT_OPTIONS = [
    { value: 'recommended', label: '⭐ Recommended' },
    { value: 'price_low', label: '💵 Cheapest (Low to High)' },
    { value: 'discount', label: '🔥 Highest Discount' },
    { value: 'expiry_asc', label: '⏰ Expiring Soon' },
    { value: 'nearest', label: '📍 Nearest First' },
    { value: 'price_high', label: '💎 Price: High to Low' },
];

const Home = () => {
    const { user } = useAuth();
    const isAdmin = user?.role === 'admin';
    const navigate = useNavigate();

    const { coords, status: locationStatus, loading: locationLoading, requestLocation, setManualLocation } = useLocation();

    const [searchQuery, setSearchQuery] = useState('');
    const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');

    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearchQuery(searchQuery);
        }, 200);
        return () => clearTimeout(timer);
    }, [searchQuery]);

    const [selectedCategory, setSelectedCategory] = useState('All');
    const [maxDistance, setMaxDistance] = useState(15);
    const [sortBy, setSortBy] = useState('recommended');
    const [products, setProducts] = useState([]);
    const [loadingProducts, setLoadingProducts] = useState(true);
    const [fetchError, setFetchError] = useState(null);
    const [showCityPicker, setShowCityPicker] = useState(false);

    // Load products from backend or fallback mock dataset
    const loadProducts = useCallback(async () => {
        setLoadingProducts(true);
        setFetchError(null);
        try {
            let data = [];
            if (coords) {
                data = await fetchNearbyProducts(coords.latitude, coords.longitude, maxDistance);
            } else {
                data = await fetchProducts();
            }
            setProducts(Array.isArray(data) ? data : []);
        } catch (err) {
            console.error('Error fetching products:', err);
            setFetchError(err.message || 'Unable to fetch products from backend');
            setProducts([]);
        } finally {
            setLoadingProducts(false);
        }
    }, [coords, maxDistance]);

    useEffect(() => {
        if (!locationLoading) {
            loadProducts();
        }
    }, [locationLoading, loadProducts]);

    const handleAdminDelete = async (productId) => {
        if (!window.confirm('Delete this listing permanently?')) return;
        try {
            await adminDeleteProduct(productId);
            setProducts(prev => (Array.isArray(prev) ? prev : []).filter(p => p && p.id !== productId));
        } catch (err) {
            alert(`Failed to delete: ${err.message}`);
        }
    };

    const handleStartSelling = () => {
        if (user) {
            navigate('/sell');
        } else {
            navigate('/login', { state: { from: '/sell' } });
        }
    };

    // Filter & Sort Products
    const filteredProducts = useMemo(() => {
        const list = Array.isArray(products) ? products : [];
        let result = list.filter(product => {
            if (!product) return false;
            const query = debouncedSearchQuery.trim().toLowerCase();
            const matchesSearch = !query ||
                (product.name && String(product.name).toLowerCase().includes(query)) ||
                (product.category && String(product.category).toLowerCase().includes(query)) ||
                (product.location && String(product.location).toLowerCase().includes(query)) ||
                (product.description && String(product.description).toLowerCase().includes(query));

            let matchesCategory = true;
            if (selectedCategory === 'Daily Essentials') {
                matchesCategory = product.category === 'Daily Essentials' || product.category === 'Dairy' || product.category === 'Bakery';
            } else if (selectedCategory === 'Near Expiry') {
                matchesCategory = true;
            } else if (selectedCategory === 'Discount Products') {
                matchesCategory = Boolean(product.originalPrice && Number(product.originalPrice) > Number(product.price));
            } else if (selectedCategory !== 'All') {
                matchesCategory = product.category === selectedCategory;
            }

            const matchesDistance = !coords || product.distance == null || (Number(product.distance) <= maxDistance);
            return matchesSearch && matchesCategory && matchesDistance;
        });

        // Apply Sorting
        return result.sort((a, b) => {
            if (!a || !b) return 0;
            if (sortBy === 'nearest') {
                return (a.distance ?? 999) - (b.distance ?? 999);
            }
            if (sortBy === 'discount') {
                const origA = Number(a.originalPrice) || 0;
                const priceA = Number(a.price) || 0;
                const discA = origA ? ((origA - priceA) / origA) : 0;

                const origB = Number(b.originalPrice) || 0;
                const priceB = Number(b.price) || 0;
                const discB = origB ? ((origB - priceB) / origB) : 0;
                return discB - discA;
            }
            if (sortBy === 'expiry_asc') {
                const timeA = a.expiry_date ? new Date(a.expiry_date).getTime() : 9999999999999;
                const timeB = b.expiry_date ? new Date(b.expiry_date).getTime() : 9999999999999;
                return (isNaN(timeA) ? 9999999999999 : timeA) - (isNaN(timeB) ? 9999999999999 : timeB);
            }
            if (sortBy === 'price_low') {
                return (Number(a.price) || 0) - (Number(b.price) || 0);
            }
            if (sortBy === 'price_high') {
                return (Number(b.price) || 0) - (Number(a.price) || 0);
            }
            return 0;
        });
    }, [products, debouncedSearchQuery, selectedCategory, maxDistance, coords, sortBy]);

    const containerVariants = {
        hidden: { opacity: 0 },
        visible: {
            opacity: 1,
            transition: { staggerChildren: 0.1 }
        }
    };

    const itemVariants = {
        hidden: { opacity: 0, y: 20 },
        visible: {
            opacity: 1,
            y: 0,
            transition: { duration: 0.4, ease: "easeOut" }
        }
    };

    const homeSEO = pageSEO({
        title: 'Hyperlocal Discount & Near-Expiry Marketplace',
        description: "Bylot is India's hyperlocal marketplace for near-expiry, surplus and discounted goods. Save up to 70% on fresh produce, dairy, bakery and daily essentials.",
        path: '/',
        structuredData: filteredProducts.length > 0 ? itemListSEO(filteredProducts, 'Featured Surplus Products') : null,
    });

    return (
        <PageTransition>
            <SEOHead {...homeSEO} />
            <div className="home-browsing-page">
                {/* ── Hero Banner Section ────────────────────────────────── */}
                <section className="hero" style={{ minHeight: 'auto', padding: '2.5rem 0 1.5rem 0', position: 'relative', overflow: 'hidden' }}>
                    <div className="google-orbit-container">
                        <div className="google-shape google-shape-blue" style={{ opacity: 0.25 }} />
                        <div className="google-shape google-shape-green" style={{ opacity: 0.25 }} />
                    </div>
                    <div className="container hero-content" style={{ position: 'relative', zIndex: 2 }}>
                        <div className="hero-text">
                            <motion.h1
                                initial={{ opacity: 0, y: -20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.6 }}
                                style={{ fontSize: '3.2rem', marginBottom: '1rem' }}
                            >
                                Save Food. Save Money. <span className="highlight">Stop Waste.</span>
                            </motion.h1>
                            <motion.p
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: 0.2, duration: 0.6 }}
                                style={{ fontSize: '1.15rem', marginBottom: '1.5rem' }}
                            >
                                Discover fresh surplus produce, bakery items, dairy & daily essentials from local stores at up to 70% off near you.
                            </motion.p>

                            {/* Hero Search Box */}
                            <motion.div
                                className="hero-search-box"
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ delay: 0.3 }}
                                style={{
                                    display: 'flex',
                                    gap: '10px',
                                    background: 'var(--bg-glass)',
                                    backdropFilter: 'blur(10px)',
                                    padding: '8px 12px',
                                    borderRadius: 'var(--radius-xl)',
                                    border: '1px solid rgba(255, 255, 255, 0.2)',
                                    boxShadow: 'var(--shadow-md)',
                                    maxWidth: '600px',
                                    marginBottom: '1.5rem'
                                }}
                            >
                                <span style={{ fontSize: '1.3rem', alignSelf: 'center', marginLeft: '6px' }}>🔍</span>
                                <input
                                    type="text"
                                    placeholder="Search milk, bread, tomatoes, fruits..."
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                    style={{
                                        border: 'none',
                                        background: 'transparent',
                                        width: '100%',
                                        fontSize: '1rem',
                                        color: 'var(--text-main)',
                                        outline: 'none'
                                    }}
                                />
                                {searchQuery && (
                                    <button
                                        onClick={() => setSearchQuery('')}
                                        style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.1rem', color: 'var(--text-muted)' }}
                                    >
                                        ✕
                                    </button>
                                )}
                            </motion.div>

                            <motion.div
                                className="hero-buttons"
                                initial={{ opacity: 0, y: 15 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.4 }}
                            >
                                <Button variant="secondary" size="md" onClick={handleStartSelling}>
                                    🏪 Sell Your Surplus Items
                                </Button>
                                <button
                                    className="btn btn-outline"
                                    onClick={() => {
                                        const el = document.getElementById('how-it-works-section');
                                        if (el) el.scrollIntoView({ behavior: 'smooth' });
                                    }}
                                >
                                    💡 How Bylot Works
                                </button>
                            </motion.div>
                        </div>

                        <motion.div
                            className="hero-image"
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ duration: 0.8 }}
                        >
                            <img
                                src="https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=800&q=80"
                                alt="Fresh discount groceries"
                                style={{ borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-lg)', maxHeight: '340px', objectFit: 'cover' }}
                            />
                        </motion.div>
                    </div>
                </section>

                {/* ── Main Browsing Area ───────────────────────────────────── */}
                <section className="browse-page container" style={{ paddingTop: '1rem' }}>
                    {/* Location bar */}
                    <div className="location-bar">
                        {locationLoading ? (
                            <span className="loc-chip loc-chip--loading">🔄 Detecting your GPS location…</span>
                        ) : coords ? (
                            <span className="loc-chip loc-chip--active">
                                📡 {locationStatus === 'manual' ? 'City Set' : 'GPS Active'}
                                <button className="loc-chip-btn" onClick={requestLocation}>Refresh GPS</button>
                            </span>
                        ) : (
                            <span className="loc-chip loc-chip--off">
                                📍 No Location Detected
                                <button className="loc-chip-btn" onClick={requestLocation}>Enable GPS</button>
                                <button className="loc-chip-btn" onClick={() => setShowCityPicker(p => !p)}>
                                    {showCityPicker ? 'Close Cities' : 'Select City'}
                                </button>
                            </span>
                        )}
                    </div>

                    {/* City picker dropdown */}
                    <AnimatePresence>
                        {showCityPicker && (
                            <motion.div
                                className="city-picker"
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                            >
                                <span style={{ width: '100%', fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--text-muted)' }}>
                                    Select your city to surface local deals:
                                </span>
                                {PRESET_CITIES.map(city => (
                                    <button
                                        key={city.name}
                                        className="city-pill"
                                        onClick={() => {
                                            setManualLocation(city);
                                            setShowCityPicker(false);
                                        }}
                                    >
                                        {city.name}
                                    </button>
                                ))}
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Category Pills Bar */}
                    <div
                        style={{
                            display: 'flex',
                            gap: '0.6rem',
                            overflowX: 'auto',
                            paddingBottom: '1rem',
                            marginBottom: '1rem',
                            scrollbarWidth: 'none'
                        }}
                    >
                        {CATEGORIES.map(cat => (
                            <button
                                key={cat}
                                onClick={() => setSelectedCategory(cat)}
                                style={{
                                    padding: '0.5rem 1.1rem',
                                    borderRadius: 'var(--radius-full)',
                                    border: selectedCategory === cat ? '2px solid var(--primary)' : '1px solid rgba(150,150,150,0.2)',
                                    background: selectedCategory === cat ? 'var(--primary)' : 'var(--bg-surface)',
                                    color: selectedCategory === cat ? '#fff' : 'var(--text-main)',
                                    fontWeight: '700',
                                    fontSize: '0.9rem',
                                    cursor: 'pointer',
                                    whiteSpace: 'nowrap',
                                    transition: 'all 0.2s ease',
                                    boxShadow: selectedCategory === cat ? 'var(--shadow-glow)' : 'none'
                                }}
                            >
                                {cat === 'All' ? '🛍️ All Deals' :
                                 cat === 'Dairy' ? '🥛 Dairy' :
                                 cat === 'Vegetables' ? '🥦 Vegetables' :
                                 cat === 'Fruits' ? '🍎 Fruits' :
                                 cat === 'Bakery' ? '🍞 Bakery' :
                                 cat === 'Daily Essentials' ? '⚡ Daily Essentials' :
                                 cat === 'Near Expiry' ? '⏰ Expiring Soon' :
                                 cat === 'Discount Products' ? '🔥 Discount Products' :
                                 cat === 'Corporate Clearance' ? '🏢 Corporate Clearance' : cat}
                            </button>
                        ))}
                    </div>

                    {/* Filter & Control Bar */}
                    <div className="browse-header">
                        {isAdmin && (
                            <div className="admin-mode-badge">🛡️ Admin Mode Enabled — Delete any listing directly</div>
                        )}

                        <div className="filter-bar">
                            <div className="filter-item search-container">
                                <span className="search-icon">🔍</span>
                                <input
                                    type="text"
                                    placeholder="Filter by keyword or store…"
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                    className="search-input"
                                />
                            </div>

                            <div className="filter-item category-container">
                                <span className="filter-icon">⚡</span>
                                <select
                                    value={selectedCategory}
                                    onChange={e => setSelectedCategory(e.target.value)}
                                    className="category-select"
                                >
                                    {CATEGORIES.map(cat => (
                                        <option key={cat} value={cat}>{cat}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="filter-item category-container">
                                <span className="filter-icon">🔃</span>
                                <select
                                    value={sortBy}
                                    onChange={e => setSortBy(e.target.value)}
                                    className="category-select"
                                >
                                    {SORT_OPTIONS.map(opt => (
                                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="filter-item distance-container" style={{ minWidth: '200px' }}>
                                <div className="distance-label" style={{ display: 'flex', gap: '6px', alignItems: 'center', marginBottom: '4px' }}>
                                    <span className="location-icon">📍</span>
                                    <span style={{ fontSize: '0.85rem', fontWeight: 'bold' }}>Max Distance</span>
                                </div>
                                <div className="slider-wrapper" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <input
                                        type="range"
                                        min="1"
                                        max="50"
                                        value={maxDistance}
                                        onChange={e => setMaxDistance(Number(e.target.value))}
                                        className="distance-slider"
                                        style={{
                                            background: `linear-gradient(to right,#6366f1 0%,#ec4899 ${(maxDistance/50)*100}%,#e2e8f0 ${(maxDistance/50)*100}%,#e2e8f0 100%)`
                                        }}
                                    />
                                    <span className="distance-value">{maxDistance} km</span>
                                </div>
                            </div>

                            <button
                                className="location-btn"
                                onClick={requestLocation}
                                disabled={locationLoading}
                                title="Locate deals near me"
                            >
                                <span className="target-icon">⌖</span>
                                {locationLoading ? 'Locating…' : 'GPS'}
                            </button>
                        </div>
                    </div>

                    {/* Results Counter */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                        <h3 style={{ fontSize: '1.4rem', fontWeight: '800' }}>
                            {selectedCategory === 'All' ? 'All Live Deals' : selectedCategory} ({filteredProducts.length})
                        </h3>
                        {(searchQuery || selectedCategory !== 'All' || sortBy !== 'recommended') && (
                            <button
                                onClick={() => {
                                    setSearchQuery('');
                                    setSelectedCategory('All');
                                    setSortBy('recommended');
                                }}
                                style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.9rem' }}
                            >
                                Reset Filters ↺
                            </button>
                        )}
                    </div>

                    {/* Product Grid */}
                    {loadingProducts ? (
                        <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}>
                            <Loader />
                        </div>
                    ) : fetchError ? (
                        <div className="fetch-error-banner">
                            <span className="fetch-error-icon">⚠️</span>
                            <div className="fetch-error-body">
                                <strong>Backend Notice</strong>
                                <p>{fetchError}</p>
                            </div>
                            <button className="btn btn-primary" onClick={loadProducts}>Retry</button>
                        </div>
                    ) : (
                        <motion.div
                            className="listings-grid"
                            variants={containerVariants}
                            initial="hidden"
                            animate="visible"
                        >
                            {filteredProducts.length > 0 ? (
                                filteredProducts.map(item => (
                                    <motion.div key={item.id} variants={itemVariants}>
                                        <ProductCard
                                            product={item}
                                            isAdmin={isAdmin}
                                            onAdminDelete={handleAdminDelete}
                                        />
                                    </motion.div>
                                ))
                            ) : (
                                <div style={{ width: '100%', gridColumn: '1 / -1', textAlign: 'center', padding: '4rem', background: 'var(--bg-glass)', borderRadius: 'var(--radius-lg)' }}>
                                    <p style={{ fontSize: '1.3rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                                        No matching deals found for your current filters.
                                    </p>
                                    <button
                                        className="btn btn-primary"
                                        onClick={() => {
                                            setSearchQuery('');
                                            setSelectedCategory('All');
                                            setMaxDistance(50);
                                        }}
                                    >
                                        Clear Filters & Show All Deals
                                    </button>
                                </div>
                            )}
                        </motion.div>
                    )}
                </section>

                {/* ── How Bylot Works Section ────────────────────────────── */}
                <section id="how-it-works-section" className="section how-it-works" style={{ paddingTop: '5rem', paddingBottom: '4rem' }}>
                    <div className="container">
                        <h2 className="section-title">How Bylot Works</h2>
                        <motion.div
                            className="steps-grid"
                            variants={containerVariants}
                            initial="hidden"
                            whileInView="visible"
                            viewport={{ once: true, amount: 0.3 }}
                        >
                            <motion.div variants={itemVariants} style={{ height: '100%' }}>
                                <Card className="step-card" style={{ height: '100%' }}>
                                    <div className="step-icon">📸</div>
                                    <h3>1. Sellers List Items</h3>
                                    <p>Local grocery stores, bakeries, and farmers list near-expiry or surplus goods at discounted prices.</p>
                                </Card>
                            </motion.div>
                            <motion.div variants={itemVariants} style={{ height: '100%' }}>
                                <Card className="step-card" style={{ height: '100%' }}>
                                    <div className="step-icon">📍</div>
                                    <h3>2. Buyers Discover Nearby</h3>
                                    <p>Customers browse deals sorted by GPS proximity (1-50 km), category, and discount percentage.</p>
                                </Card>
                            </motion.div>
                            <motion.div variants={itemVariants} style={{ height: '100%' }}>
                                <Card className="step-card" style={{ height: '100%' }}>
                                    <div className="step-icon">🤝</div>
                                    <h3>3. Save Money & Stop Waste</h3>
                                    <p>Purchase directly online or contact sellers for quick pickup. Save money while protecting the environment!</p>
                                </Card>
                            </motion.div>
                        </motion.div>
                    </div>
                </section>
            </div>
        </PageTransition>
    );
};

export default Home;
