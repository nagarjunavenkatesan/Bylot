import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import Button from '../components/Button';
import Card from '../components/Card';
import PageTransition from '../components/PageTransition';
import { fetchProducts } from '../api/backendApi';
import '../styles/Home.css';

const Home = () => {
    const [items, setItems] = React.useState([]);
    const [nearbyOnly, setNearbyOnly] = React.useState(false);
    const [userLocation, setUserLocation] = React.useState(null);

    React.useEffect(() => {
        fetchItems();
    }, [nearbyOnly, userLocation]);

    const fetchItems = async () => {
        try {
            const params = nearbyOnly && userLocation
                ? { latitude: userLocation.latitude, longitude: userLocation.longitude }
                : {};
            const data = await fetchProducts(params);
            setItems(data);
        } catch (error) {
            console.error('Error fetching products:', error);
        }
    };

    const handleNearbyToggle = () => {
        if (!nearbyOnly) {
            if (navigator.geolocation) {
                navigator.geolocation.getCurrentPosition(
                    (position) => {
                        setUserLocation(position.coords);
                        setNearbyOnly(true);
                    },
                    (error) => {
                        console.error("Error getting location:", error);
                        alert("Unable to retrieve your location. Please enable location services.");
                    }
                );
            } else {
                alert("Geolocation is not supported by this browser.");
            }
        } else {
            setNearbyOnly(false);
            setUserLocation(null);
        }
    };

    const navigate = useNavigate();

    const handleStartSelling = () => {
        const user = localStorage.getItem('user');
        if (user) {
            navigate('/sell');
        } else {
            navigate('/login');
        }
    };

    const containerVariants = {
        hidden: { opacity: 0 },
        visible: {
            opacity: 1,
            transition: {
                staggerChildren: 0.2
            }
        }
    };

    const itemVariants = {
        hidden: { opacity: 0, y: 30 },
        visible: {
            opacity: 1,
            y: 0,
            transition: { duration: 0.6, ease: "easeOut" }
        }
    };

    return (
        <PageTransition>
            <div className="home">
                {/* Hero Section */}
                <section className="hero">
                    <div className="container hero-content">
                        <div className="hero-text">
                            <motion.h1
                                initial={{ opacity: 0, y: -30 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.8, ease: "easeOut" }}
                            >
                                Save Food. Save Money. <span className="highlight">Stop Waste.</span>
                            </motion.h1>
                            <motion.p
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: 0.3, duration: 0.8 }}
                            >
                                Bylot connects you with local sellers to buy fresh, timeless good at unbeatable prices.
                            </motion.p>
                            <motion.div
                                className="hero-buttons"
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ delay: 0.5, duration: 0.5 }}
                            >
                                <Link to="/browse">
                                    <Button variant="primary" size="lg">Start Buying</Button>
                                </Link>
                                <Button variant="secondary" size="lg" onClick={handleStartSelling}>Start Selling</Button>
                            </motion.div>
                        </div>
                        <motion.div
                            className="hero-image"
                            initial={{ opacity: 0, x: 50 }}
                            animate={{ 
                                opacity: 1, 
                                x: 0,
                                y: [0, -20, 0], 
                                rotateX: [0, 5, 0], 
                                rotateY: [0, 10, 0]
                            }}
                            transition={{ 
                                opacity: { duration: 0.8 },
                                x: { duration: 0.8 },
                                y: { repeat: Infinity, duration: 6, ease: "easeInOut" },
                                rotateX: { repeat: Infinity, duration: 7, ease: "easeInOut" },
                                rotateY: { repeat: Infinity, duration: 8, ease: "easeInOut" }
                            }}
                            style={{ perspective: 1000 }}
                        >
                            <img src="https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=800&q=80" alt="Fresh vegetables" style={{ transformStyle: 'preserve-3d' }} />
                        </motion.div>
                    </div>
                </section>

                {/* How it Works */}
                <section className="section how-it-works">
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
                                    <h3>1. List It</h3>
                                    <p>Sellers list near-expiry items with a photo and price.</p>
                                </Card>
                            </motion.div>
                            <motion.div variants={itemVariants} style={{ height: '100%' }}>
                                <Card className="step-card" style={{ height: '100%' }}>
                                    <div className="step-icon">🔍</div>
                                    <h3>2. Find It</h3>
                                    <p>Buyers browse listings based on location and needs.</p>
                                </Card>
                            </motion.div>
                            <motion.div variants={itemVariants} style={{ height: '100%' }}>
                                <Card className="step-card" style={{ height: '100%' }}>
                                    <div className="step-icon">🤝</div>
                                    <h3>3. Buy It</h3>
                                    <p>Connect directly to buy and save money instantly.</p>
                                </Card>
                            </motion.div>
                        </motion.div>
                    </div>
                </section>

                {/* Featured Listings */}
                <section className="section featured">
                    <div className="container">
                        <div className="section-header">
                            <h2 className="section-title">{nearbyOnly ? 'Items Near You' : 'Featured Deals'}</h2>
                            <div style={{ display: 'flex', gap: '10px' }}>
                                <Button
                                    variant={nearbyOnly ? "primary" : "outline"}
                                    size="sm"
                                    onClick={handleNearbyToggle}
                                >
                                    {nearbyOnly ? 'Show All' : 'Show Nearby'}
                                </Button>
                                <Link to="/browse">
                                    <Button variant="outline" size="sm">View All</Button>
                                </Link>
                            </div>
                        </div>
                        <motion.div
                            className="listings-grid"
                            variants={containerVariants}
                            initial="hidden"
                            whileInView="visible"
                            viewport={{ once: true, amount: 0.1 }}
                        >
                            {items.length === 0 ? (
                                <p>No items found.</p>
                            ) : (
                                items.map(item => (
                                    <motion.div key={item.id} variants={itemVariants}>
                                        <Card className="listing-card">
                                            <div className="listing-image-container">
                                                <img src={item.image || 'https://via.placeholder.com/400'} alt={item.name} className="card-image" />
                                                <span className="expiry-tag">Expires: {item.expiry}</span>
                                            </div>
                                            <div className="listing-details">
                                                <h3 className="card-title">{item.name}</h3>
                                                <p className="card-subtitle">
                                                    {item.distance ? `${Math.round(item.distance)} km away` : item.location}
                                                </p>
                                                <div className="price-row">
                                                    <span className="current-price">₹{item.price}</span>
                                                    {item.originalPrice && <span className="original-price">₹{item.originalPrice}</span>}
                                                </div>
                                                <Link to={`/product/${item.id}`} className="w-full">
                                                    <Button variant="primary" className="w-full">View Deal</Button>
                                                </Link>
                                            </div>
                                        </Card>
                                    </motion.div>
                                ))
                            )}
                        </motion.div>
                    </div>
                </section>
            </div>
        </PageTransition>
    );
};

export default Home;
