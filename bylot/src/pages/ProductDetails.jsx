import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import Button from '../components/Button';
import PageTransition from '../components/PageTransition';
import { fetchProductById, deleteProduct, adminDeleteProduct, apiRequest } from '../api/backendApi';
import '../styles/ProductDetails.css';

const ProductDetails = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [product, setProduct] = React.useState(null);
    const [currentUser, setCurrentUser] = React.useState(null);

    React.useEffect(() => {
        const userStr = localStorage.getItem('user');
        if (userStr) setCurrentUser(JSON.parse(userStr));

        fetchProductById(id)
            .then(setProduct)
            .catch(err => console.error('Error fetching product:', err));
    }, [id]);

    if (!product) return <div style={{ padding: '4rem', textAlign: 'center' }}>Loading...</div>;

    const isAdmin = currentUser?.role === 'admin';
    const isOwner = currentUser && product && currentUser.id == product.seller_id;

    const handleBuyNow = async () => {
        if (!currentUser) {
            navigate('/login', { state: { from: `/product/${id}` } });
            return;
        }
        try {
            await apiRequest('/api/orders', {
                method: 'POST',
                body: JSON.stringify({
                    sellerId: product.seller_id,
                    items: [{ productId: Number(id), quantity: 1 }]
                }),
            });
            alert('Purchase recorded successfully!');
        } catch (err) {
            alert(err.message || 'Unable to complete purchase');
        }
    };

    const handleDelete = async () => {
        if (!window.confirm('Are you sure you want to delete this item?')) return;
        try {
            if (isAdmin) await adminDeleteProduct(id);
            else await deleteProduct(id);
            alert('Item deleted successfully');
            navigate('/');
        } catch (err) {
            alert(`Error deleting item: ${err.message}`);
        }
    };

    const handleShare = async () => {
        if (navigator.share) {
            try { await navigator.share({ title: product.name, text: `Check out ${product.name} on Bylot!`, url: window.location.href }); }
            catch (_) {}
        } else {
            navigator.clipboard.writeText(window.location.href);
            alert('Link copied to clipboard!');
        }
    };

    return (
        <PageTransition>
            <div className="product-details-page container">
                <motion.div className="details-grid" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.5 }}>
                    <div className="product-image-section">
                        <img src={product.image || 'https://via.placeholder.com/400'} alt={product.name} className="main-image" />
                    </div>
                    <div className="product-info-section">
                        <div className="product-header">
                            <h1>{product.name}</h1>
                            <span className="expiry-badge">Expires: {product.expiry}</span>
                        </div>
                        <div className="price-block">
                            <span className="current-price-lg">₹{product.price}</span>
                            {product.originalPrice && Number(product.originalPrice) > Number(product.price) && (
                                <>
                                    <span className="original-price-lg">₹{product.originalPrice}</span>
                                    <span className="discount-tag">Save ₹{(Number(product.originalPrice) - Number(product.price)).toFixed(0)}</span>
                                </>
                            )}
                        </div>
                        <div className="info-row">
                            <span className="label">Location:</span>
                            <span className="value">{product.location || 'Not specified'}</span>
                        </div>
                        <div className="info-row">
                            <span className="label">Seller:</span>
                            <span className="value">{product.seller_name || 'Unknown Seller'}</span>
                        </div>
                        <div className="description-block">
                            <h3>Description</h3>
                            <p>{product.description || 'No description provided.'}</p>
                        </div>
                        <div className="action-buttons">
                            {(isOwner || isAdmin) ? (
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', width: '100%' }}>
                                    <Button variant="outline" onClick={() => navigate(`/edit-item/${id}`)}>Edit Item</Button>
                                    <Button variant="primary" style={{ backgroundColor: 'var(--error)', borderColor: 'var(--error)' }} onClick={handleDelete}>Delete Item</Button>
                                </div>
                            ) : (
                                <>
                                    <Button variant="primary" size="lg" className="w-full" onClick={handleBuyNow}>Buy Now</Button>
                                    <Button variant="outline" size="lg" className="w-full" onClick={() => product.seller_id && navigate(`/seller/${product.seller_id}`)}>Contact Seller</Button>
                                </>
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
