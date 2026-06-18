import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import Card from './Card';
import { FaTrash, FaEdit, FaFlag } from 'react-icons/fa';
import { apiRequest } from '../api/backendApi';

const REPORT_REASONS = [
    { value: 'fake_product',      label: 'Fake / counterfeit product' },
    { value: 'wrong_expiry',      label: 'Wrong expiry date listed' },
    { value: 'misleading_price',  label: 'Misleading price' },
    { value: 'poor_quality',      label: 'Poor quality / damaged' },
    { value: 'already_expired',   label: 'Product already expired' },
    { value: 'other',             label: 'Other' },
];

const ProductCard = ({ product, isOwner, onDelete, isAdmin, onAdminDelete }) => {
    const [showReport, setShowReport]     = useState(false);
    const [reason, setReason]             = useState('fake_product');
    const [description, setDescription]  = useState('');
    const [reporting, setReporting]       = useState(false);
    const [reported, setReported]         = useState(false);

    const handleReport = async (e) => {
        e.preventDefault();
        e.stopPropagation();

        const token = localStorage.getItem('accessToken');
        if (!token) {
            alert('Please log in to report a product.');
            return;
        }

        setReporting(true);
        try {
            await apiRequest(`/api/products/${product.id}/report`, {
                method: 'POST',
                body: JSON.stringify({ reason, description }),
            });
            setReported(true);
            setShowReport(false);
            setDescription('');
        } catch (err) {
            alert(err.message || 'Failed to submit report. Please try again.');
        } finally {
            setReporting(false);
        }
    };

    return (
        <Card className="listing-card">
            {/* Product image */}
            <Link to={`/product/${product.id}`} style={{ display: 'block', color: 'inherit' }}>
                <div className="listing-image-container">
                    <img
                        src={product.image}
                        alt={product.name}
                        className="card-image"
                        onError={e => { e.target.onerror = null; e.target.src = 'https://via.placeholder.com/400?text=No+Image'; }}
                    />
                    <span className="expiry-tag">Expires: {product.expiry}</span>
                    {product.distance != null && (
                        <span className="distance-tag">{Number(product.distance).toFixed(1)} km away</span>
                    )}
                </div>
            </Link>

            {/* Product details */}
            <div className="listing-details">
                <Link to={`/product/${product.id}`} style={{ display: 'block', color: 'inherit' }}>
                    <h3 className="card-title">{product.name}</h3>
                    <p className="card-subtitle">{product.location}</p>
                    <div className="price-row">
                        <span className="current-price">₹{product.price}</span>
                        {product.originalPrice && <span className="original-price">₹{product.originalPrice}</span>}
                    </div>
                </Link>

                {/* Owner / Admin actions */}
                {(isOwner || isAdmin) && (
                    <div className="owner-actions" style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                        {isOwner && (
                            <Link to={`/edit-item/${product.id}`} className="w-full">
                                <button className="btn btn-secondary w-full" style={{ padding: '6px 12px', fontSize: '0.85rem' }}>
                                    <FaEdit style={{ marginRight: '5px' }} /> Edit
                                </button>
                            </Link>
                        )}
                        <button
                            className="btn w-full"
                            onClick={e => { e.preventDefault(); e.stopPropagation(); isAdmin && onAdminDelete ? onAdminDelete(product.id) : onDelete && onDelete(product.id); }}
                            style={{ padding: '6px 12px', fontSize: '0.85rem', background: '#ef4444', color: 'white', borderRadius: 'var(--radius-full)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        >
                            <FaTrash style={{ marginRight: '5px' }} /> Delete
                        </button>
                    </div>
                )}

                {/* ── Report Fraud button (shown to all non-owners) ── */}
                {!isOwner && !isAdmin && (
                    <div className="report-fraud-section">
                        {reported ? (
                            <span className="report-sent-badge">✓ Report submitted</span>
                        ) : (
                            <>
                                <button
                                    type="button"
                                    className={`report-flag-btn ${showReport ? 'active' : ''}`}
                                    onClick={e => { e.preventDefault(); e.stopPropagation(); setShowReport(p => !p); }}
                                    title="Report this product as fraud"
                                >
                                    <FaFlag style={{ marginRight: '5px' }} />
                                    Report Fraud
                                </button>

                                {showReport && (
                                    <form
                                        className="report-form"
                                        onSubmit={handleReport}
                                        onClick={e => e.stopPropagation()}
                                    >
                                        <select
                                            value={reason}
                                            onChange={e => setReason(e.target.value)}
                                            className="report-select"
                                            required
                                        >
                                            {REPORT_REASONS.map(r => (
                                                <option key={r.value} value={r.value}>{r.label}</option>
                                            ))}
                                        </select>
                                        <textarea
                                            value={description}
                                            onChange={e => setDescription(e.target.value)}
                                            className="report-textarea"
                                            placeholder="Optional: add more details..."
                                            rows={2}
                                            maxLength={500}
                                        />
                                        <div className="report-form-actions">
                                            <button
                                                type="button"
                                                className="report-cancel-btn"
                                                onClick={e => { e.stopPropagation(); setShowReport(false); }}
                                            >
                                                Cancel
                                            </button>
                                            <button
                                                type="submit"
                                                className="report-submit-btn"
                                                disabled={reporting}
                                            >
                                                {reporting ? 'Sending...' : 'Send Report'}
                                            </button>
                                        </div>
                                    </form>
                                )}
                            </>
                        )}
                    </div>
                )}
            </div>
        </Card>
    );
};

export default ProductCard;
