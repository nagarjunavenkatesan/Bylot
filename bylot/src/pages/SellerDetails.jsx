import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import Button from '../components/Button';
import PageTransition from '../components/PageTransition';
import '../styles/SellerDetails.css';

const SellerDetails = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [seller, setSeller] = React.useState(null);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState(null);

    React.useEffect(() => {
        const fetchSeller = async () => {
            try {
                const response = await fetch(`/api/users/${id}`);
                if (!response.ok) {
                    throw new Error('Seller not found');
                }
                const data = await response.json();
                
                // Format joined date
                const joinedDate = new Date(data.created_at).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'short'
                });

                setSeller({
                    ...data,
                    rating: 4.8, // Placeholder
                    joined: joinedDate,
                    location: 'Location not set', // Placeholder
                    description: 'No description provided yet.', // Placeholder
                    image: `https://ui-avatars.com/api/?name=${encodeURIComponent(data.name)}&background=random`
                });
            } catch (err) {
                console.error(err);
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        fetchSeller();
    }, [id]);

    if (loading) {
        return (
            <div className="container" style={{ padding: '4rem', textAlign: 'center' }}>
                <div className="loader"></div>
            </div>
        );
    }

    if (error || !seller) {
        return (
            <div className="container" style={{ padding: '4rem', textAlign: 'center' }}>
                <h2>Seller not found</h2>
                <Button onClick={() => navigate(-1)}>Go Back</Button>
            </div>
        );
    }

    return (
        <PageTransition>
            <div className="seller-details-page container">
                <Button variant="secondary" onClick={() => navigate(-1)} className="back-btn">
                    &larr; Back
                </Button>

                <motion.div
                    className="seller-card"
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, ease: "easeOut" }}
                >
                    <div className="seller-header">
                        <img src={seller.image} alt={seller.name} className="seller-image" />
                        <div className="seller-info">
                            <h1>{seller.name}</h1>
                            <p className="location">{seller.location}</p>
                            <div className="rating">
                                <span className="star">★</span> {seller.rating} • Joined {seller.joined}
                            </div>
                        </div>
                    </div>

                    <div className="seller-body">
                        <h3>About Seller</h3>
                        <p>{seller.description}</p>

                        <div className="contact-info">
                            <h3>Contact Information</h3>
                            <div className="contact-item">
                                <span className="icon">📞</span>
                                {seller.phone ? (
                                    <a href={`tel:${seller.phone}`}>{seller.phone}</a>
                                ) : (
                                    <span className="text-muted">Not provided</span>
                                )}
                            </div>
                            <div className="contact-item">
                                <span className="icon">✉️</span>
                                <a href={`mailto:${seller.email}`}>{seller.email}</a>
                            </div>
                        </div>
                    </div>
                </motion.div>
            </div>
        </PageTransition>
    );
};

export default SellerDetails;
