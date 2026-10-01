import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '../components/Button';
import PageTransition from '../components/PageTransition';
import { apiRequest } from '../api/backendApi';
import { useAuth } from '../context/AuthContext';
import '../styles/Sell.css';

const DISTRICTS = [
    'Chennai', 'Coimbatore', 'Madurai', 'Tiruchirappalli', 'Salem', 'Tirunelveli',
    'Thanjavur', 'Vellore', 'Erode', 'Dindigul', 'Thoothukudi', 'Karur',
    'Kanchipuram', 'Cuddalore', 'Theni', 'Namakkal', 'Sivaganga', 'Virudhunagar',
    'Ramanathapuram', 'Other',
];

const Sell = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [showPhoneModal, setShowPhoneModal] = useState(() => {
        return user ? !user.phone : false;
    });
    const [phoneNumber, setPhoneNumber] = useState('');
    const [formData, setFormData] = useState({
        name: '', description: '', price: '', originalPrice: '',
        expiryDate: '', location: '', locationLink: '',
        latitude: null, longitude: null,
        category: 'Vegetables', district: 'Chennai', image: null
    });

    useEffect(() => {
        if (!user) { navigate('/login', { state: { from: '/sell' } }); return; }
    }, [user, navigate]);

    const handleSavePhone = async e => {
        e.preventDefault();
        try {
            await apiRequest('/api/users/profile', {
                method: 'POST',
                body: JSON.stringify({ phone: phoneNumber }),
            });
            let current = {};
            try {
                current = JSON.parse(localStorage.getItem('user') || '{}');
            } catch {
                current = {};
            }
            const updatedUser = { ...current, phone: phoneNumber };
            localStorage.setItem('user', JSON.stringify(updatedUser));
            if (typeof window !== 'undefined') {
                window.dispatchEvent(new Event('storage'));
            }
            setShowPhoneModal(false);
            alert('Phone number saved!');
        } catch (err) {
            alert(err.message || 'Failed to save phone number');
        }
    };

    const handleChange = e => setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    const handleImageChange = e => { if (e.target.files?.[0]) setFormData(prev => ({ ...prev, image: e.target.files[0] })); };

    const handleLocationClick = () => {
        if (!navigator.geolocation) { alert('Geolocation not supported'); return; }
        navigator.geolocation.getCurrentPosition(
            pos => {
                const { latitude, longitude } = pos.coords;
                const link = `https://www.google.com/maps?q=${latitude},${longitude}`;
                setFormData(prev => ({ ...prev, latitude, longitude, locationLink: link, location: link }));
            },
            () => alert('Unable to retrieve your location.')
        );
    };

    const handleSubmit = async e => {
        e.preventDefault();
        try {
            const data = new FormData();
            data.append('name', formData.name);
            data.append('description', formData.description);
            data.append('price', formData.price);
            data.append('originalPrice', formData.originalPrice || formData.price);
            data.append('expiryDate', formData.expiryDate);
            data.append('category', formData.category);
            data.append('district', formData.district);
            if (formData.latitude)  data.append('latitude',  formData.latitude);
            if (formData.longitude) data.append('longitude', formData.longitude);
            if (formData.image) {
                data.append('image', formData.image);
            } else {
                data.append('imageUrl', 'https://images.unsplash.com/photo-1563636619-e9143da7973b?auto=format&fit=crop&w=800&q=80');
            }

            // First upload image if present, then create product
            await apiRequest('/api/sellers/products', { method: 'POST', body: data });
            alert('Listing created successfully!');
            if (window.AndroidNative) {
                window.AndroidNative.showNotification('New Item Listed!', `You listed ${formData.name} for sale.`);
            }
            navigate('/');
        } catch (err) {
            alert(err.message || 'Failed to create listing');
        }
    };

    return (
        <PageTransition>
            <div className="sell-page container">
                {showPhoneModal && (
                    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.8)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(5px)' }}>
                        <div
                            style={{ backgroundColor: 'var(--card-bg)', padding: '2rem', borderRadius: '1rem', maxWidth: '400px', width: '90%', boxShadow: '0 10px 25px rgba(0,0,0,0.5)', border: '1px solid var(--border-color)' }}>
                            <h3 style={{ marginBottom: '1rem' }}>Complete Your Profile</h3>
                            <p style={{ marginBottom: '1.5rem', color: 'var(--text-muted)' }}>A verified phone number is required for all sellers.</p>
                            <form onSubmit={handleSavePhone}>
                                <div className="form-group">
                                    <label htmlFor="phoneModalInput">Phone Number</label>
                                    <input id="phoneModalInput" type="tel" className="form-input" value={phoneNumber} onChange={e => setPhoneNumber(e.target.value)} placeholder="+91 98765 43210" required style={{ width: '100%' }} />
                                </div>
                                <Button type="submit" variant="primary" className="w-full">Verify & Continue</Button>
                            </form>
                        </div>
                    </div>
                )}

                <div className="sell-container">
                    <h2>List Your Item</h2>
                    <p className="subtitle">Help reduce waste and recover your investment.</p>
                    <form onSubmit={handleSubmit} className="sell-form">
                        <div className="form-group">
                            <label htmlFor="name">Product Name</label>
                            <input type="text" id="name" name="name" value={formData.name} onChange={handleChange} placeholder="e.g., Fresh Tomatoes" required />
                        </div>
                        <div className="form-group">
                            <label htmlFor="category">Category</label>
                            <select id="category" name="category" value={formData.category} onChange={handleChange}>
                                <option>Vegetables</option><option>Fruits</option><option>Dairy</option><option>Bakery</option><option>Other</option>
                            </select>
                        </div>
                        <div className="form-group">
                            <label htmlFor="district">District</label>
                            <select id="district" name="district" value={formData.district} onChange={handleChange} required>
                                {DISTRICTS.map(d => <option key={d}>{d}</option>)}
                            </select>
                        </div>
                        <div className="form-row">
                            <div className="form-group">
                                <label htmlFor="price">Sale Price (₹)</label>
                                <input type="number" id="price" name="price" value={formData.price} onChange={handleChange} placeholder="40" required />
                            </div>
                            <div className="form-group">
                                <label htmlFor="originalPrice">Original Price (₹)</label>
                                <input type="number" id="originalPrice" name="originalPrice" value={formData.originalPrice} onChange={handleChange} placeholder="60" required />
                            </div>
                        </div>
                        <div className="form-row">
                            <div className="form-group">
                                <label htmlFor="expiryDate">Expiry Date</label>
                                <input type="date" id="expiryDate" name="expiryDate" value={formData.expiryDate} onChange={handleChange} required />
                            </div>
                            <div className="form-group">
                                <label htmlFor="location">Shop Address / Location Link</label>
                                <div style={{ display: 'flex', gap: '10px' }}>
                                    <input type="text" id="location" name="location" value={formData.location} onChange={handleChange} placeholder="Address or Google Maps Link" required style={{ flex: 1 }} />
                                    <Button type="button" variant="outline" onClick={handleLocationClick}>Use GPS</Button>
                                </div>
                            </div>
                        </div>
                        <div className="form-group">
                            <label htmlFor="description">Description</label>
                            <textarea id="description" name="description" value={formData.description} onChange={handleChange} placeholder="Describe the condition and quantity..." rows="4" />
                        </div>
                        <div className="form-group">
                            <label htmlFor="image">Product Image</label>
                            <div className="file-upload">
                                <input type="file" id="image" name="image" accept="image/*" onChange={handleImageChange} />
                                <div className="upload-placeholder">{formData.image ? formData.image.name : 'Click to upload photo'}</div>
                            </div>
                        </div>
                        <Button type="submit" variant="primary" size="lg" className="w-full">Create Listing</Button>
                    </form>
                </div>
            </div>
        </PageTransition>
    );
};

export default Sell;
