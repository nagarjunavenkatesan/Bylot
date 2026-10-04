import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { FaCamera, FaFolderOpen, FaTimes, FaMapMarkerAlt, FaStore } from 'react-icons/fa';
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

const CATEGORIES = ['Vegetables', 'Fruits', 'Dairy', 'Bakery', 'Daily Essentials',
    'Snacks', 'Beverages', 'Meat & Seafood', 'Frozen Foods', 'Other'];

const initialForm = {
    name: '', description: '', price: '', originalPrice: '',
    expiryDate: '', location: '', latitude: null, longitude: null,
    category: 'Vegetables', district: 'Chennai',
    stockQuantity: '1', image: null, imagePreview: null,
};

export default function Sell() {
    const navigate = useNavigate();
    const { user } = useAuth();
    const cameraInputRef = useRef(null);
    const galleryInputRef = useRef(null);

    const [form, setForm] = useState(initialForm);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [showPhoneModal, setShowPhoneModal] = useState(false);
    const [phoneNumber, setPhoneNumber] = useState('');
    const [showImagePicker, setShowImagePicker] = useState(false);

    useEffect(() => {
        if (!user) { navigate('/login', { state: { from: '/sell' } }); return; }
        if (!user.phone) setShowPhoneModal(true);
    }, [user, navigate]);

    const set = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

    const handleChange = e => set(e.target.name, e.target.value);

    const handleImage = (file) => {
        if (!file) return;
        const preview = URL.createObjectURL(file);
        setForm(prev => ({ ...prev, image: file, imagePreview: preview }));
        setShowImagePicker(false);
    };

    const removeImage = () => {
        if (form.imagePreview) URL.revokeObjectURL(form.imagePreview);
        setForm(prev => ({ ...prev, image: null, imagePreview: null }));
    };

    const handleGPS = () => {
        if (!navigator.geolocation) { setError('Geolocation not supported by this browser'); return; }
        navigator.geolocation.getCurrentPosition(
            pos => {
                const { latitude, longitude } = pos.coords;
                const link = `https://www.google.com/maps?q=${latitude},${longitude}`;
                setForm(prev => ({ ...prev, latitude, longitude, location: link }));
            },
            () => setError('Unable to get location. Please enter address manually.')
        );
    };

    const handleSavePhone = async e => {
        e.preventDefault();
        try {
            await apiRequest('/api/users/profile', {
                method: 'POST', body: JSON.stringify({ phone: phoneNumber }),
            });
            const stored = JSON.parse(localStorage.getItem('user') || '{}');
            localStorage.setItem('user', JSON.stringify({ ...stored, phone: phoneNumber }));
            window.dispatchEvent(new Event('storage'));
            setShowPhoneModal(false);
        } catch (err) {
            setError(err.message || 'Failed to save phone number');
        }
    };

    const handleSubmit = async e => {
        e.preventDefault();
        setError(''); setSuccess('');

        const price = Number(form.price);
        const original = Number(form.originalPrice || form.price);
        if (!form.name.trim()) return setError('Product name is required.');
        if (!price || price <= 0) return setError('Sale price must be greater than 0.');
        if (original < price) return setError('Original price must be ≥ sale price.');
        if (!form.expiryDate) return setError('Expiry date is required.');
        if (!form.location.trim()) return setError('Location is required.');

        setSubmitting(true);
        try {
            const data = new FormData();
            data.append('name', form.name.trim());
            data.append('description', form.description.trim());
            data.append('price', price);
            data.append('sellingPrice', price);
            data.append('originalPrice', original);
            data.append('mrp', original);
            data.append('expiryDate', form.expiryDate);
            data.append('category', form.category);
            data.append('district', form.district);
            data.append('stockQuantity', form.stockQuantity || '1');
            data.append('location', form.location.trim());
            if (form.latitude)  data.append('latitude',  form.latitude);
            if (form.longitude) data.append('longitude', form.longitude);
            if (form.image) {
                data.append('image', form.image);
            } else {
                data.append('imageUrl', 'https://images.unsplash.com/photo-1563636619-e9143da7973b?auto=format&fit=crop&w=800&q=80');
            }

            await apiRequest('/api/sellers/products', { method: 'POST', body: data });
            setSuccess('Listing created successfully! Redirecting…');
            setTimeout(() => navigate('/sell'), 1500);
        } catch (err) {
            setError(err.message || 'Failed to create listing. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

    if (!user) return null;

    return (
        <PageTransition>
            {/* ── Phone modal ── */}
            {showPhoneModal && (
                <div className="sell-modal-backdrop">
                    <div className="sell-modal">
                        <h3>Complete Your Profile</h3>
                        <p>A verified phone number is required for all sellers.</p>
                        <form onSubmit={handleSavePhone} className="sell-modal-form">
                            <label htmlFor="phoneModalInput">Phone Number</label>
                            <input
                                id="phoneModalInput" type="tel" className="sell-input"
                                value={phoneNumber} onChange={e => setPhoneNumber(e.target.value)}
                                placeholder="+91 98765 43210" required
                                inputMode="tel" autoComplete="tel"
                            />
                            <button type="submit" className="sell-btn-primary">Verify &amp; Continue</button>
                        </form>
                    </div>
                </div>
            )}

            <div className="sell-page container">
                <div className="sell-container">
                    {/* ── Header ── */}
                    <div className="sell-toolbar">
                        <div>
                            <h2 className="sell-title">List Your Item</h2>
                            <p className="sell-subtitle">Help reduce waste and recover your investment.</p>
                        </div>
                        <Link to="/seller/orders" className="btn btn-secondary sell-orders-link">
                            <FaStore style={{ marginRight: '0.4rem' }} /> Seller Orders
                        </Link>
                    </div>

                    {/* ── Alerts ── */}
                    {error   && <div className="sell-alert sell-alert--error"   role="alert">{error}</div>}
                    {success && <div className="sell-alert sell-alert--success" role="status">{success}</div>}

                    <form onSubmit={handleSubmit} className="sell-form" noValidate>
                        {/* Product Name */}
                        <div className="sell-field">
                            <label className="sell-label" htmlFor="name">Product Name <span className="sell-required">*</span></label>
                            <input
                                id="name" name="name" type="text"
                                className="sell-input"
                                value={form.name} onChange={handleChange}
                                placeholder="e.g., Fresh Tomatoes (1kg)"
                                required autoComplete="off"
                            />
                        </div>

                        {/* Category + District */}
                        <div className="sell-row">
                            <div className="sell-field">
                                <label className="sell-label" htmlFor="category">Category <span className="sell-required">*</span></label>
                                <select id="category" name="category" className="sell-input sell-select"
                                    value={form.category} onChange={handleChange}>
                                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                            </div>
                            <div className="sell-field">
                                <label className="sell-label" htmlFor="district">District <span className="sell-required">*</span></label>
                                <select id="district" name="district" className="sell-input sell-select"
                                    value={form.district} onChange={handleChange} required>
                                    {DISTRICTS.map(d => <option key={d} value={d}>{d}</option>)}
                                </select>
                            </div>
                        </div>

                        {/* Prices */}
                        <div className="sell-row">
                            <div className="sell-field">
                                <label className="sell-label" htmlFor="price">Sale Price (₹) <span className="sell-required">*</span></label>
                                <input
                                    id="price" name="price" type="number"
                                    className="sell-input"
                                    value={form.price} onChange={handleChange}
                                    placeholder="40" min="0" required
                                    inputMode="decimal"
                                />
                            </div>
                            <div className="sell-field">
                                <label className="sell-label" htmlFor="originalPrice">Original / MRP (₹) <span className="sell-required">*</span></label>
                                <input
                                    id="originalPrice" name="originalPrice" type="number"
                                    className="sell-input"
                                    value={form.originalPrice} onChange={handleChange}
                                    placeholder="70" min="0" required
                                    inputMode="decimal"
                                />
                            </div>
                        </div>

                        {/* Expiry + Stock */}
                        <div className="sell-row">
                            <div className="sell-field">
                                <label className="sell-label" htmlFor="expiryDate">Expiry Date <span className="sell-required">*</span></label>
                                <input
                                    id="expiryDate" name="expiryDate" type="date"
                                    className="sell-input sell-input--date"
                                    value={form.expiryDate} onChange={handleChange}
                                    required
                                />
                            </div>
                            <div className="sell-field">
                                <label className="sell-label" htmlFor="stockQuantity">Stock Quantity <span className="sell-required">*</span></label>
                                <input
                                    id="stockQuantity" name="stockQuantity" type="number"
                                    className="sell-input"
                                    value={form.stockQuantity} onChange={handleChange}
                                    placeholder="1" min="0" required
                                    inputMode="numeric"
                                />
                            </div>
                        </div>

                        {/* Location */}
                        <div className="sell-field">
                            <label className="sell-label" htmlFor="location">Shop Address / Location <span className="sell-required">*</span></label>
                            <div className="sell-location-row">
                                <input
                                    id="location" name="location" type="text"
                                    className="sell-input"
                                    value={form.location} onChange={handleChange}
                                    placeholder="Street address or paste Google Maps link"
                                    required
                                />
                                <button type="button" className="sell-gps-btn" onClick={handleGPS}>
                                    <FaMapMarkerAlt /> GPS
                                </button>
                            </div>
                        </div>

                        {/* Description */}
                        <div className="sell-field">
                            <label className="sell-label" htmlFor="description">Description</label>
                            <textarea
                                id="description" name="description"
                                className="sell-input sell-textarea"
                                value={form.description} onChange={handleChange}
                                placeholder="Describe the condition, quantity and any special notes…"
                                rows={4}
                            />
                        </div>

                        {/* ── Image upload ── */}
                        <div className="sell-field">
                            <label className="sell-label">Product Image</label>

                            {form.imagePreview ? (
                                <div className="sell-image-preview">
                                    <img src={form.imagePreview} alt="Preview" />
                                    <button
                                        type="button" className="sell-image-remove"
                                        onClick={removeImage} aria-label="Remove image"
                                    >
                                        <FaTimes />
                                    </button>
                                    <span className="sell-image-name">{form.image?.name}</span>
                                </div>
                            ) : (
                                <>
                                    <button
                                        type="button"
                                        className="sell-upload-zone"
                                        onClick={() => setShowImagePicker(p => !p)}
                                        aria-expanded={showImagePicker}
                                    >
                                        <div className="sell-upload-icon">📷</div>
                                        <span className="sell-upload-label">Add Photo</span>
                                        <span className="sell-upload-hint">Tap to choose from camera or gallery</span>
                                    </button>

                                    {showImagePicker && (
                                        <div className="sell-image-options">
                                            {/* Camera capture */}
                                            <label className="sell-img-option" htmlFor="imgCamera">
                                                <FaCamera className="sell-img-option-icon" />
                                                <span>Take Photo</span>
                                                <input
                                                    ref={cameraInputRef}
                                                    id="imgCamera" type="file"
                                                    accept="image/*" capture="environment"
                                                    style={{ display: 'none' }}
                                                    onChange={e => handleImage(e.target.files?.[0])}
                                                />
                                            </label>

                                            {/* Gallery / file picker */}
                                            <label className="sell-img-option" htmlFor="imgGallery">
                                                <FaFolderOpen className="sell-img-option-icon" />
                                                <span>Choose File</span>
                                                <input
                                                    ref={galleryInputRef}
                                                    id="imgGallery" type="file"
                                                    accept="image/*"
                                                    style={{ display: 'none' }}
                                                    onChange={e => handleImage(e.target.files?.[0])}
                                                />
                                            </label>
                                        </div>
                                    )}
                                </>
                            )}
                            <p className="sell-upload-footnote">
                                Optional — a default image will be used if none is uploaded.
                            </p>
                        </div>

                        <button
                            type="submit"
                            className="sell-btn-primary sell-btn-submit"
                            disabled={submitting}
                        >
                            {submitting ? 'Creating…' : '✓ Create Listing'}
                        </button>
                    </form>
                </div>
            </div>
        </PageTransition>
    );
}
