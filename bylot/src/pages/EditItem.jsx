import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import PageTransition from '../components/PageTransition';
import Loader from '../components/Loader';
import { apiRequest } from '../api/backendApi';

const EditItem = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [formData, setFormData] = useState({
        name: '', description: '', price: '', originalPrice: '',
        category: 'Vegetables', expiryDate: '', location: ''
    });

    const categories = ['Vegetables', 'Fruits', 'Dairy', 'Bakery', 'Other'];

    useEffect(() => {
        apiRequest(`/api/products/${id}`)
            .then(res => {
                const d = res?.data || res;
                let formattedExpiryDate = '';
                if (d.expiry_date) {
                    try {
                        const dateObj = new Date(d.expiry_date);
                        if (!isNaN(dateObj.getTime())) {
                            formattedExpiryDate = dateObj.toISOString().split('T')[0];
                        }
                    } catch (_) {
                        formattedExpiryDate = '';
                    }
                }
                setFormData({
                    name: d.name || '',
                    description: d.description || '',
                    price: d.selling_price || d.price || '',
                    originalPrice: d.mrp || d.original_price || '',
                    category: d.category_name || d.category || 'Vegetables',
                    expiryDate: formattedExpiryDate,
                    location: d.city || d.location || '',
                });
            })
            .catch(err => {
                console.error('Error fetching item:', err);
                alert('Could not load item details');
                navigate('/profile');
            })
            .finally(() => setLoading(false));
    }, [id, navigate]);

    const handleChange = e => setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));

    const handleSubmit = async e => {
        e.preventDefault();
        try {
            await apiRequest(`/api/sellers/products/${id}`, {
                method: 'PUT',
                body: JSON.stringify({
                    name: formData.name,
                    description: formData.description,
                    price: Number(formData.price),
                    originalPrice: Number(formData.originalPrice || formData.price),
                    expiryDate: formData.expiryDate || undefined,
                    category: formData.category,
                    location: formData.location,
                    status: 'active',
                }),
            });
            alert('Item updated successfully!');
            navigate('/profile');
        } catch (err) {
            alert(err.message || 'Failed to update item');
        }
    };

    if (loading) return <Loader />;

    return (
        <PageTransition>
            <div className="container" style={{ padding: '2rem 1rem', maxWidth: '600px', margin: '0 auto' }}>
                <h2 className="section-title">Edit Listing</h2>
                <form onSubmit={handleSubmit}
                    className="sell-form" style={{ background: 'var(--card-bg)', padding: '2rem', borderRadius: '1rem', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
                    <div className="form-group">
                        <label className="form-label">Product Name</label>
                        <input type="text" name="name" className="form-input" value={formData.name} onChange={handleChange} required />
                    </div>
                    <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                        <div className="form-group">
                            <label className="form-label">Sale Price (₹)</label>
                            <input type="number" name="price" className="form-input" value={formData.price} onChange={handleChange} required />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Original Price (₹)</label>
                            <input type="number" name="originalPrice" className="form-input" value={formData.originalPrice} onChange={handleChange} />
                        </div>
                    </div>
                    <div className="form-group">
                        <label className="form-label">Category</label>
                        <select name="category" className="form-input" value={formData.category} onChange={handleChange}>
                            {categories.map(c => <option key={c}>{c}</option>)}
                        </select>
                    </div>
                    <div className="form-group">
                        <label className="form-label">Expiry Date</label>
                        <input type="date" name="expiryDate" className="form-input" value={formData.expiryDate} onChange={handleChange} />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Description</label>
                        <textarea name="description" className="form-input" value={formData.description} onChange={handleChange} rows="3" />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Shop/Stall Address</label>
                        <input type="text" name="location" className="form-input" value={formData.location} onChange={handleChange} />
                    </div>
                    <button type="submit" className="btn btn-primary w-full" style={{ marginTop: '1rem' }}>Update Listing</button>
                    <button type="button" className="btn btn-secondary w-full" style={{ marginTop: '0.5rem' }} onClick={() => navigate('/profile')}>Cancel</button>
                </form>
            </div>
        </PageTransition>
    );
};

export default EditItem;
