import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import Button from '../components/Button';
import PageTransition from '../components/PageTransition';
import '../styles/Sell.css';

const Sell = () => {
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        price: '',
        originalPrice: '',
        expiryDate: '',
        location: '',
        locationLink: '',
        latitude: null,
        longitude: null,
        category: 'Vegetables',
        image: null
    });

    const navigate = useNavigate();


    const [showPhoneModal, setShowPhoneModal] = useState(false);
    const [phoneNumber, setPhoneNumber] = useState('');

    useEffect(() => {
        const userStr = localStorage.getItem('user');
        if (!userStr) {
            navigate('/login', { state: { from: '/sell' } });
            return;
        }

        const user = JSON.parse(userStr);
        if (!user.phone) {
            setShowPhoneModal(true);
        }
    }, [navigate]);

    const handleSavePhone = async (e) => {
        e.preventDefault();
        try {
            const user = JSON.parse(localStorage.getItem('user'));
            const response = await fetch(`/api/users/${user.id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ phone: phoneNumber }),
            });

            if (response.ok) {
                const data = await response.json();
                // Update local storage with new user data including phone
                localStorage.setItem('user', JSON.stringify(data.user));
                setShowPhoneModal(false);
                alert('Phone number verified successfully!');
            } else {
                alert('Failed to save phone number');
            }
        } catch (error) {
            console.error('Error saving phone number:', error);
            alert('Error saving phone number');
        }
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleImageChange = (e) => {
        if (e.target.files && e.target.files[0]) {
            setFormData(prev => ({ ...prev, image: e.target.files[0] }));
        }
    };

    const handleLocationClick = () => {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const { latitude, longitude } = position.coords;
                    const link = `https://www.google.com/maps?q=${latitude},${longitude}`;
                    setFormData(prev => ({
                        ...prev,
                        latitude,
                        longitude,
                        locationLink: link,
                        location: link // Pre-fill location text with link
                    }));
                },
                (error) => {
                    console.error("Error getting location:", error);
                    alert("Unable to retrieve your location.");
                }
            );
        } else {
            alert("Geolocation is not supported by this browser.");
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        try {
            const user = JSON.parse(localStorage.getItem('user'));
            
            const data = new FormData();
            data.append('name', formData.name);
            data.append('description', formData.description);
            data.append('price', formData.price);
            data.append('originalPrice', formData.originalPrice);
            data.append('expiryDate', formData.expiryDate);
            data.append('category', formData.category);
            data.append('location', formData.location);
            data.append('locationLink', formData.locationLink || '');
            data.append('latitude', formData.latitude || ''); // Send empty string if null/undefined
            data.append('longitude', formData.longitude || '');
            data.append('sellerId', user.id || 1); 
            
            if (formData.image) {
                data.append('image', formData.image);
            } else {
                 data.append('imageUrl', 'https://images.unsplash.com/photo-1563636619-e9143da7973b?auto=format&fit=crop&w=800&q=80');
            }

            const response = await fetch('/api/items', {
                method: 'POST',
                // Do NOT set Content-Type header when sending FormData, let browser set it with boundary
                body: data,
            });

            if (response.ok) {
                alert('Listing created successfully!');
                navigate('/');
            } else {
                alert('Failed to create listing');
            }
        } catch (error) {
            console.error('Error creating listing:', error);
            alert('Error creating listing');
        }
    };

    return (
        <PageTransition>
            <div className="sell-page container">
                {showPhoneModal && (
                    <div style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        backgroundColor: 'rgba(0,0,0,0.8)',
                        zIndex: 1000,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        backdropFilter: 'blur(5px)'
                    }}>
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            style={{
                                backgroundColor: 'var(--card-bg)',
                                padding: '2rem',
                                borderRadius: '1rem',
                                maxWidth: '400px',
                                width: '90%',
                                boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
                                border: '1px solid var(--border-color)'
                            }}
                        >
                            <h3 style={{ marginBottom: '1rem', color: 'var(--text-primary)' }}>Complete Your Profile</h3>
                            <p style={{ marginBottom: '1.5rem', color: 'var(--text-secondary)' }}>
                                To ensure trust and safety in our community, verified phone numbers are required for all sellers.
                            </p>
                            <form onSubmit={handleSavePhone}>
                                <div className="form-group">
                                    <label htmlFor="phoneModalInput">Phone Number</label>
                                    <input
                                        id="phoneModalInput"
                                        type="tel"
                                        className="form-input"
                                        value={phoneNumber}
                                        onChange={(e) => setPhoneNumber(e.target.value)}
                                        placeholder="+91 98765 43210"
                                        required
                                        style={{ width: '100%' }}
                                    />
                                </div>
                                <Button type="submit" variant="primary" className="w-full">
                                    Verify & Continue
                                </Button>
                            </form>
                        </motion.div>
                    </div>
                )}

                <motion.div
                    className="sell-container"
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, ease: "easeOut" }}
                >
                    <h2>List Your Item</h2>
                    <p className="subtitle">Help reduce waste and recover your investment.</p>

                    <form onSubmit={handleSubmit} className="sell-form">
                        <div className="form-group">
                            <label htmlFor="name">Product Name</label>
                            <input
                                type="text"
                                id="name"
                                name="name"
                                value={formData.name}
                                onChange={handleChange}
                                placeholder="e.g., Fresh Tomatoes"
                                required
                            />
                        </div>

                        <div className="form-group">
                            <label htmlFor="category">Category</label>
                            <select
                                id="category"
                                name="category"
                                value={formData.category}
                                onChange={handleChange}
                            >
                                <option value="Vegetables">Vegetables</option>
                                <option value="Fruits">Fruits</option>
                                <option value="Dairy">Dairy</option>
                                <option value="Bakery">Bakery</option>
                                <option value="Other">Other</option>
                            </select>
                        </div>

                        <div className="form-row">
                            <div className="form-group">
                                <label htmlFor="price">Sale Price (₹)</label>
                                <input
                                    type="number"
                                    id="price"
                                    name="price"
                                    value={formData.price}
                                    onChange={handleChange}
                                    placeholder="40"
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <label htmlFor="originalPrice">Original Price (₹)</label>
                                <input
                                    type="number"
                                    id="originalPrice"
                                    name="originalPrice"
                                    value={formData.originalPrice}
                                    onChange={handleChange}
                                    placeholder="60"
                                    required
                                />
                            </div>
                        </div>

                        <div className="form-row">
                            <div className="form-group">
                                <label htmlFor="expiryDate">Expiry Date</label>
                                <input
                                    type="date"
                                    id="expiryDate"
                                    name="expiryDate"
                                    value={formData.expiryDate}
                                    onChange={handleChange}
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <label htmlFor="location">Shop Address / Location Link</label>
                                <div style={{ display: 'flex', gap: '10px' }}>
                                    <input
                                        type="text"
                                        id="location"
                                        name="location"
                                        value={formData.location}
                                        onChange={handleChange}
                                        placeholder="Address or Google Maps Link"
                                        required
                                        style={{ flex: 1 }}
                                    />
                                    <Button type="button" variant="outline" onClick={handleLocationClick}>
                                        Use Location
                                    </Button>
                                </div>
                            </div>
                        </div>

                        <div className="form-group">
                            <label htmlFor="description">Description</label>
                            <textarea
                                id="description"
                                name="description"
                                value={formData.description}
                                onChange={handleChange}
                                placeholder="Describe the condition and quantity..."
                                rows="4"
                            ></textarea>
                        </div>

                        <div className="form-group">
                            <label htmlFor="image">Product Image</label>
                            <div className="file-upload">
                                <input
                                    type="file"
                                    id="image"
                                    name="image"
                                    accept="image/*"
                                    onChange={handleImageChange}
                                />
                                <div className="upload-placeholder">
                                    {formData.image ? formData.image.name : 'Click to upload photo'}
                                </div>
                            </div>
                        </div>

                        <Button type="submit" variant="primary" size="lg" className="w-full">
                            Create Listing
                        </Button>
                    </form>
                </motion.div>
            </div>
        </PageTransition>
    );
};

export default Sell;
