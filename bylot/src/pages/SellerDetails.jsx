import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import Button from '../components/Button';
import PageTransition from '../components/PageTransition';
import SEOHead from '../components/SEOHead';
import { sellerSEO, pageSEO } from '../utils/seo';
import { apiRequest } from '../api/backendApi';
import '../styles/SellerDetails.css';
import NotFound from './NotFound';

const SellerDetails = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [seller, setSeller] = React.useState(null);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState(null);

    React.useEffect(() => {
        // Fetch a product from this seller to get seller info (public endpoint)
        apiRequest(`/api/products?sellerId=${id}&limit=1`)
            .then(json => {
                const list = Array.isArray(json?.data) ? json.data : [];
                const product = list[0];
                if (!product) throw new Error('Seller not found');
                setSeller({
                    displayName: product.seller_name || 'Verified Seller',
                    joined: 'Bylot Merchant',
                    location: product.city || product.location || 'Location not set',
                    description: 'No description provided yet.',
                    image: `https://ui-avatars.com/api/?name=${encodeURIComponent(product.seller_name || 'S')}&background=random`,
                    phone: null,
                    email: null,
                });
            })
            .catch(err => setError(err.message))
            .finally(() => setLoading(false));
    }, [id]);

    const seoProps = seller
        ? sellerSEO({ ...seller, id, store_name: seller.displayName })
        : pageSEO({ title: 'Seller Profile', path: `/seller/${id}` });

    if (loading) {
        return (
            <PageTransition>
                <SEOHead {...seoProps} />
                <div className="container" style={{ padding: '4rem', textAlign: 'center' }}><div className="loader"></div></div>
            </PageTransition>
        );
    }

    if (error || !seller) {
        return <NotFound />;
    }

    return (
        <PageTransition>
            <SEOHead {...seoProps} />
            <div className="seller-details-page container">
                <Button variant="secondary" onClick={() => navigate(-1)} className="back-btn">&larr; Back</Button>
                <motion.div className="seller-card" initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
                    <div className="seller-header">
                        <img src={seller.image} alt={seller.displayName} className="seller-image" />
                        <div className="seller-info">
                            <h1>{seller.displayName}</h1>
                            <p className="location">{seller.location}</p>
                            <div className="rating"><span className="star">✓</span> Verified Merchant</div>
                        </div>
                    </div>
                    <div className="seller-body">
                        <h3>About Seller</h3>
                        <p>{seller.description}</p>
                        <div className="contact-info">
                            <h3>Contact Information</h3>
                            <div className="contact-item">
                                <span className="icon">📞</span>
                                {seller.phone ? <a href={`tel:${seller.phone}`}>{seller.phone}</a> : <span className="text-muted">Not provided</span>}
                            </div>
                            <div className="contact-item">
                                <span className="icon">✉️</span>
                                {seller.email ? <a href={`mailto:${seller.email}`}>{seller.email}</a> : <span className="text-muted">Not provided</span>}
                            </div>
                        </div>
                    </div>
                </motion.div>
            </div>
        </PageTransition>
    );
};

export default SellerDetails;
