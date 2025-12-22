import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import Button from '../components/Button';
import PageTransition from '../components/PageTransition';
import '../styles/ProductDetails.css';

const ProductDetails = () => {
    const { id } = useParams();
    const navigate = useNavigate();

    const [product, setProduct] = React.useState(null);

    const [currentUser, setCurrentUser] = React.useState(null);

    React.useEffect(() => {
        const fetchProduct = async () => {
            try {
                const response = await fetch(`/api/items/${id}`);
                if (response.ok) {
                    const data = await response.json();
                    setProduct(data);
                }
            } catch (error) {
                console.error('Error fetching product:', error);
            }
        };

        const userStr = localStorage.getItem('user');
        if (userStr) {
            setCurrentUser(JSON.parse(userStr));
        }

        fetchProduct();
    }, [id]);

    if (!product) return <div>Loading...</div>;

    const isOwner = currentUser && product && currentUser.id == product.seller_id;

    const handleContactSeller = () => {
        // Navigate to seller details page (no login required)
        if (product.seller_id) {
            navigate(`/seller/${product.seller_id}`);
        } else {
            console.error("No seller ID associated with this product.");
        }
    };

    const handleEdit = () => {
        navigate(`/edit-item/${id}`);
    };

    const handleDelete = async () => {
        if (window.confirm('Are you sure you want to delete this item?')) {
            try {
                const response = await fetch(`/api/items/${id}`, {
                    method: 'DELETE',
                });
                if (response.ok) {
                    alert('Item deleted successfully');
                    navigate('/');
                } else {
                    alert('Failed to delete item');
                }
            } catch (error) {
                console.error('Error deleting item:', error);
                alert('Error deleting item');
            }
        }
    };

    const handleShare = async () => {
        if (navigator.share) {
            try {
                await navigator.share({
                    title: product.name,
                    text: `Check out ${product.name} on Bylot!`,
                    url: window.location.href,
                });
            } catch (err) {
                console.error('Error sharing:', err);
            }
        } else {
            // Fallback
            navigator.clipboard.writeText(window.location.href);
            alert('Link copied to clipboard!');
        }
    };

    return (
        <PageTransition>
            <div className="product-details-page container">
                <motion.div
                    className="details-grid"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.5 }}
                >
                    <div className="product-image-section">
                        <img src={product.image_url || 'https://via.placeholder.com/400'} alt={product.name} className="main-image" />
                    </div>
                    <div className="product-info-section">
                        <div className="product-header">
                            <h1>{product.name}</h1>
                            <span className="expiry-badge">Expires: {new Date(product.expiry_date).toLocaleDateString()}</span>
                        </div>

                        <div className="price-block">
                            <span className="current-price-lg">₹{product.price}</span>
                            {product.original_price && Number(product.original_price) > Number(product.price) && (
                                <>
                                    <span className="original-price-lg">₹{product.original_price}</span>
                                    <span className="discount-tag">Save ₹{(Number(product.original_price) - Number(product.price)).toFixed(0)}</span>
                                </>
                            )}
                        </div>

                        <div className="info-row">
                            <span className="label">Location:</span>
                            {product.location_link ? (
                                <a href={product.location_link} target="_blank" rel="noopener noreferrer" className="value" style={{ color: 'var(--primary)', textDecoration: 'underline' }}>
                                    View on Map
                                </a>
                            ) : (
                                <span className="value">{product.location || 'Not specified'}</span>
                            )}
                        </div>

                        <div className="info-row">
                            <span className="label">Seller:</span>
                            <span className="value">{product.seller_name || 'Unknown Seller'}</span>
                        </div>

                        <div className="description-block">
                            <h3>Description</h3>
                            <p>{product.description}</p>
                        </div>

                        <div className="action-buttons">
                            {isOwner ? (
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', width: '100%' }}>
                                    <Button variant="outline" onClick={handleEdit}>Edit Item</Button>
                                    <Button variant="primary" style={{ backgroundColor: 'var(--error)', borderColor: 'var(--error)' }} onClick={handleDelete}>Delete Item</Button>
                                </div>
                            ) : (
                                <Button variant="primary" size="lg" className="w-full" onClick={handleContactSeller}>Contact Seller</Button>
                            )}
                            <Button variant="outline" size="lg" className="w-full" onClick={handleShare}>Share</Button>
                        </div>
                    </div>
                </motion.div>
            </div>
        </PageTransition>
    );
};

export default ProductDetails;
