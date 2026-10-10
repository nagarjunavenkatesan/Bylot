import React from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import Button from '../components/Button';
import PageTransition from '../components/PageTransition';
import { fetchProductById, deleteProduct, adminDeleteProduct, apiRequest } from '../api/backendApi';
import SEOHead from '../components/SEOHead';
import { productSEO, pageSEO, breadcrumbSEO } from '../utils/seo';
import '../styles/ProductDetails.css';
import { getProductPricing } from '../utils/pricing';
import { useAuth } from '../context/AuthContext';
import NotFound from './NotFound';

const ProductDetails = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { user: currentUser } = useAuth();
    const [product, setProduct] = React.useState(null);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState(null);

    React.useEffect(() => {
        let isMounted = true;
        setLoading(true);
        setError(null);
        fetchProductById(id)
            .then(data => {
                if (isMounted) {
                    if (!data) setError('Product not found');
                    else setProduct(data);
                }
            })
            .catch(err => {
                if (isMounted) setError(err.message || 'Product not found');
            })
            .finally(() => {
                if (isMounted) setLoading(false);
            });
        return () => { isMounted = false; };
    }, [id]);

    const seoProps = product ? productSEO(product) : pageSEO({ title: 'Product Details', path: `/product/${id}` });

    if (product) {
        const catName = product.category || 'Daily Essentials';
        const catSlug = catName.toLowerCase().replace(/\s+/g, '-');
        const bSEO = breadcrumbSEO([
            { name: 'Home', path: '/' },
            { name: catName, path: `/category/${catSlug}` },
            { name: product.name, path: `/product/${product.id}` }
        ]);
        seoProps.structuredData = [seoProps.structuredData, bSEO];
    }

    if (loading) {
        return (
            <PageTransition>
                <SEOHead title="Loading Product | Bylot" />
                <div style={{ padding: '4rem', textAlign: 'center' }}><div className="loader"></div></div>
            </PageTransition>
        );
    }

    if (error || !product) {
        return <NotFound />;
    }

    const pricing = getProductPricing(product);
    const isAdmin = currentUser?.role === 'admin';
    const isOwner = currentUser && product && currentUser.id == product.seller_id;

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
            catch (err) {
                console.error('Share failed:', err);
            }
        } else {
            try {
                await navigator.clipboard.writeText(window.location.href);
                alert('Link copied to clipboard!');
            } catch (err) {
                console.error('Clipboard write failed:', err);
            }
        }
    };

    return (
        <PageTransition>
            <SEOHead {...seoProps} />
            <div className="product-details-page container">
                <nav aria-label="Breadcrumb" style={{ marginBottom: '1.25rem', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                    <Link to="/" style={{ color: 'var(--primary)', textDecoration: 'none' }}>Home</Link>
                    <span style={{ margin: '0 0.5rem' }}>/</span>
                    <Link to={`/category/${(product.category || 'daily-essentials').toLowerCase().replace(/\s+/g, '-')}`} style={{ color: 'var(--primary)', textDecoration: 'none' }}>
                        {product.category || 'Daily Essentials'}
                    </Link>
                    <span style={{ margin: '0 0.5rem' }}>/</span>
                    <span style={{ fontWeight: 600 }}>{product.name}</span>
                </nav>
                <div className="details-grid">
                    <div className="product-image-section">
                        <img
                            src={product.image || 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=800&q=80'}
                            alt={product.name ? `${product.name} - Near-Expiry Product Deal` : 'Product Image'}
                            className="main-image"
                            width="500"
                            height="400"
                            loading="eager"
                            fetchPriority="high"
                            decoding="async"
                            onError={e => { e.target.onerror = null; e.target.src = 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=800&q=80'; }}
                        />
                    </div>
                    <div className="product-info-section">
                        <div className="product-header">
                            <div>
                                <span style={{ fontSize: '0.85rem', fontWeight: '800', color: 'var(--primary)', background: 'rgba(99, 102, 241, 0.14)', padding: '3px 10px', borderRadius: '8px', display: 'inline-block', marginBottom: '0.5rem' }}>
                                    Item ID: {product.product_item_id || `#${product.id}`}
                                </span>
                                <h1>{product.name}</h1>
                            </div>
                            <span className="expiry-badge">Expires: {product.expiry}</span>
                        </div>
                        <div className="price-block">
                            <span className="current-price-lg">{pricing.formattedSelling || `₹${product.price}`}</span>
                            {pricing.hasSavings && (
                                <span className="original-price-lg">{pricing.formattedMrp}</span>
                            )}
                        </div>
                        {pricing.hasSavings && (
                            <p className="savings-badge savings-badge-lg" aria-label={pricing.ariaLabel}>
                                {pricing.savingsLabel}
                            </p>
                        )}
                        <div className="info-row">
                            <span className="label">Item ID:</span>
                            <span className="value" style={{ fontWeight: '800', color: 'var(--primary)' }}>{product.product_item_id || `#${product.id}`}</span>
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
                                <Button variant="primary" size="lg" className="w-full" onClick={() => product.seller_id && navigate(`/seller/${product.seller_id}`)}>Contact Seller</Button>
                            )}
                            <Button variant="outline" size="lg" className="w-full" onClick={handleShare}>Share</Button>
                        </div>
                    </div>
                </div>
            </div>
        </PageTransition>
    );
};

export default ProductDetails;
