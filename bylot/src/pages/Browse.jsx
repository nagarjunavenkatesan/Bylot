import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import ProductCard from '../components/ProductCard';
import PageTransition from '../components/PageTransition';
import Loader from '../components/Loader';
import '../styles/Browse.css';

const Browse = () => {
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('All');
    const [maxDistance, setMaxDistance] = useState(15);
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const categories = ['All', 'Dairy', 'Vegetables', 'Fruits', 'Bakery'];

    useEffect(() => {
        const fetchProducts = async () => {
            try {
                const response = await fetch('/api/items');
                if (!response.ok) throw new Error('Failed to fetch items');
                const data = await response.json();
                
                // Transform API data to match UI expected format if needed
                // The API returns snake_case keys like original_price, mock data was camelCase
                const transformedData = data.map(item => ({
                    ...item,
                    originalPrice: item.original_price, // Map snake_case to camelCase
                    image: item.image_url || 'https://via.placeholder.com/500', // Fallback image
                    expiry: item.expiry_date ? new Date(item.expiry_date).toLocaleDateString() : 'N/A',
                    location: item.location || 'Unknown',
                    distance: item.distance || Math.floor(Math.random() * 10) + 1 // Fallback random distance if not provided
                }));

                setProducts(transformedData);
            } catch (err) {
                setError(err.message);
                console.error('Error fetching items:', err);
            } finally {
                setLoading(false);
            }
        };

        fetchProducts();
    }, []);

    const filteredProducts = products.filter(product => {
        const matchesSearch = product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            product.category.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesCategory = selectedCategory === 'All' || product.category === selectedCategory;
        const matchesDistance = product.distance <= maxDistance;

        return matchesSearch && matchesCategory && matchesDistance;
    });

    const containerVariants = {
        hidden: { opacity: 0 },
        visible: {
            opacity: 1,
            transition: {
                staggerChildren: 0.1
            }
        }
    };

    const itemVariants = {
        hidden: { opacity: 0, y: 20 },
        visible: { opacity: 1, y: 0 }
    };

    if (loading) return <Loader />;
    if (error) return <div className="text-center p-8 text-red-500">Error: {error}</div>;

    return (
        <PageTransition>
            <div className="browse-page container">
                <div className="browse-header">
                    <h2>Browse Listings</h2>

                    {/* Advanced Filter Bar */}
                    <div className="filter-bar">
                        {/* Search Input */}
                        <div className="filter-item search-container">
                            <span className="search-icon">🔍</span>
                            <input
                                type="text"
                                placeholder="Search for eggs, milk, spinach..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="search-input"
                            />
                        </div>

                        {/* Category Dropdown */}
                        <div className="filter-item category-container">
                            <span className="filter-icon">⚡</span>
                            <select
                                value={selectedCategory}
                                onChange={(e) => setSelectedCategory(e.target.value)}
                                className="category-select"
                            >
                                {categories.map(cat => (
                                    <option key={cat} value={cat}>{cat}</option>
                                ))}
                            </select>
                        </div>

                        {/* Distance Slider */}
                        <div className="filter-item distance-container">
                            <div className="distance-label">
                                <span className="location-icon">📍</span>
                                <span>Max distance</span>
                            </div>
                            <div className="slider-wrapper">
                                <input
                                    type="range"
                                    min="1"
                                    max="15"
                                    value={maxDistance}
                                    onChange={(e) => setMaxDistance(Number(e.target.value))}
                                    className="distance-slider"
                                    style={{ background: `linear-gradient(to right, #6366f1 0%, #ec4899 ${(maxDistance / 15) * 100}%, #e2e8f0 ${(maxDistance / 15) * 100}%, #e2e8f0 100%)` }}
                                />
                                <span className="distance-value">{maxDistance} km</span>
                            </div>
                        </div>

                        {/* Location Button */}
                        <button className="location-btn">
                            <span className="target-icon">⌖</span>
                            Use my location
                        </button>
                    </div>
                </div>

                <motion.div
                    className="listings-grid"
                    variants={containerVariants}
                    initial="hidden"
                    animate="visible"
                >
                    {filteredProducts.length > 0 ? (
                        filteredProducts.map(item => (
                            <motion.div key={item.id} variants={itemVariants}>
                                <ProductCard product={item} />
                            </motion.div>
                        ))
                    ) : (
                        <div className="no-results" style={{ width: '100%', gridColumn: '1 / -1', textAlign: 'center', padding: '2rem' }}>
                            <p>No items found matching your filters.</p>
                            <button
                                className="btn-link"
                                onClick={() => {
                                    setSearchQuery('');
                                    setSelectedCategory('All');
                                    setMaxDistance(15);
                                }}
                                style={{ color: 'var(--primary)', cursor: 'pointer', background: 'none', border: 'none', textDecoration: 'underline' }}
                            >
                                Clear all filters
                            </button>
                        </div>
                    )}
                </motion.div>
            </div>
        </PageTransition>
    );
};

export default Browse;
