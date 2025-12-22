import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import PageTransition from '../components/PageTransition';
import Loader from '../components/Loader';

const EditItem = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        price: '',
        originalPrice: '',
        category: 'Vegetables',
        expiryDate: '',
        location: '',
        locationLink: '',
        sellerId: null 
    });

    const categories = ['Vegetables', 'Fruits', 'Dairy', 'Bakery', 'Other'];

    useEffect(() => {
        const fetchItem = async () => {
            try {
                const response = await fetch(`/api/items/${id}`);
                if (!response.ok) throw new Error('Failed to fetch item');
                const data = await response.json();
                
                // Populate form
                setFormData({
                    name: data.name,
                    description: data.description || '',
                    price: data.price,
                    originalPrice: data.original_price || '',
                    category: data.category,
                    expiryDate: data.expiry_date ? new Date(data.expiry_date).toISOString().split('T')[0] : '',
                    location: data.location || '',
                    locationLink: data.location_link || '',
                    sellerId: data.seller_id,
                    imageUrl: data.image_url // Keep image URL but don't show in basic form edits for now
                });
            } catch (error) {
                console.error('Error fetching item:', error);
                alert('Could not load item details');
                navigate('/profile');
            } finally {
                setLoading(false);
            }
        };

        fetchItem();
    }, [id, navigate]);

    const handleChange = (e) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        try {
            const response = await fetch(`/api/items/${id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(formData),
            });

            if (response.ok) {
                alert('Item updated successfully!');
                navigate('/profile');
            } else {
                alert('Failed to update item');
            }
        } catch (error) {
            console.error('Error updating item:', error);
            alert('Error updating item');
        }
    };

    if (loading) return <Loader />;

    return (
        <PageTransition>
            <div className="container" style={{ padding: '2rem 1rem', maxWidth: '600px', margin: '0 auto' }}>
                <h2 className="section-title">Edit Listing</h2>
                <motion.form 
                    onSubmit={handleSubmit}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="sell-form"
                    style={{ background: 'var(--card-bg)', padding: '2rem', borderRadius: '1rem', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                >
                     <div className="form-group">
                        <label className="form-label">Product Name</label>
                        <input
                            type="text"
                            name="name"
                            className="form-input"
                            value={formData.name}
                            onChange={handleChange}
                            required
                        />
                    </div>

                    <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                        <div className="form-group">
                            <label className="form-label">Sale Price (₹)</label>
                            <input
                                type="number"
                                name="price"
                                className="form-input"
                                value={formData.price}
                                onChange={handleChange}
                                required
                            />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Original Price (₹)</label>
                            <input
                                type="number"
                                name="originalPrice"
                                className="form-input"
                                value={formData.originalPrice}
                                onChange={handleChange}
                            />
                        </div>
                    </div>

                    <div className="form-group">
                        <label className="form-label">Category</label>
                        <select
                            name="category"
                            className="form-input"
                            value={formData.category}
                            onChange={handleChange}
                        >
                            {categories.map(cat => (
                                <option key={cat} value={cat}>{cat}</option>
                            ))}
                        </select>
                    </div>

                    <div className="form-group">
                        <label className="form-label">Expiry Date</label>
                        <input
                            type="date"
                            name="expiryDate"
                            className="form-input"
                            value={formData.expiryDate}
                            onChange={handleChange}
                            required
                        />
                    </div>

                    <div className="form-group">
                        <label className="form-label">Brief Description</label>
                        <textarea
                            name="description"
                            className="form-input"
                            value={formData.description}
                            onChange={handleChange}
                            rows="3"
                        />
                    </div>

                     <div className="form-group">
                        <label className="form-label">Shop/Stall Address</label>
                         <input
                            type="text"
                            name="location"
                            className="form-input"
                            value={formData.location}
                            onChange={handleChange}
                            required
                        />
                    </div>

                    <button type="submit" className="btn btn-primary w-full" style={{ marginTop: '1rem' }}>
                        Update Listing
                    </button>
                    <button 
                        type="button" 
                        className="btn btn-secondary w-full" 
                        style={{ marginTop: '0.5rem' }}
                        onClick={() => navigate('/profile')}
                    >
                        Cancel
                    </button>
                </motion.form>
            </div>
        </PageTransition>
    );
};

export default EditItem;
