import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import ProductCard from '../components/ProductCard';
import PageTransition from '../components/PageTransition';
import { useAuth } from '../context/AuthContext';
import { deleteProduct, fetchProducts, apiRequest } from '../api/backendApi';

const Profile = () => {
    const navigate = useNavigate();
    const { user, logout } = useAuth();
    const [myItems, setMyItems] = useState([]);
    const [loadingItems, setLoadingItems] = useState(true);

    useEffect(() => {
        if (!user) {
            navigate('/login');
            return;
        }
        fetchMyItems(user.id);
    }, [user, navigate]);

    const fetchMyItems = async (userId) => {
        try {
            // First get the seller profile to find the seller table ID
            let sellerId = null;
            try {
                const sellerRes = await apiRequest('/api/sellers/profile');
                sellerId = sellerRes?.data?.id || null;
            } catch (_) {
                // user is not a seller — no products to show
            }
            if (sellerId) {
                const products = await fetchProducts({ sellerId });
                setMyItems(Array.isArray(products) ? products : []);
            }
        } catch (error) {
            console.error('Error fetching my items:', error);
        } finally {
            setLoadingItems(false);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Are you sure you want to delete this item?')) return;
        
        try {
            await deleteProduct(id);
            setMyItems(prev => prev.filter(item => item.id !== id));
            alert('Item deleted successfully');
        } catch (error) {
            console.error('Error deleting item:', error);
            alert(`Error deleting item: ${error.message}`);
        }
    };

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    if (!user) return null;

    return (
        <PageTransition>
            <div className="container" style={{ padding: '2rem 1rem' }}>
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="profile-header"
                    style={{
                        background: 'var(--card-bg)',
                        padding: '2rem',
                        borderRadius: '1rem',
                        marginBottom: '2rem',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: '1rem',
                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                    }}
                >
                    <div>
                        <h1 style={{ marginBottom: '0.5rem' }}>Hello, {user.name}</h1>
                        <p style={{ color: 'var(--text-muted)' }}>{user.email}</p>
                        <p style={{ color: 'var(--text-muted)' }}>{user.phone}</p>
                    </div>
                    <button 
                        onClick={handleLogout} 
                        className="btn btn-secondary"
                        style={{ height: 'fit-content' }}
                    >
                        Logout
                    </button>
                </motion.div>

                <h2 className="section-title">My Listings ({myItems.length})</h2>
                
                {loadingItems ? (
                    <p>Loading your items...</p>
                ) : myItems.length > 0 ? (
                    <div className="grid">
                        {myItems.map(item => (
                            <ProductCard 
                                key={item.id} 
                                product={item} 
                                isOwner={true}
                                onDelete={handleDelete}
                            />
                        ))}
                    </div>
                ) : (
                    <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                        <p>You haven't listed any items yet.</p>
                        <button 
                            className="btn btn-primary" 
                            style={{ marginTop: '1rem' }}
                            onClick={() => navigate('/sell')}
                        >
                            Start Selling
                        </button>
                    </div>
                )}
            </div>
        </PageTransition>
    );
};

export default Profile;
