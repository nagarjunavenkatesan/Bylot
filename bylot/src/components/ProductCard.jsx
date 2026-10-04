import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import Card from './Card';
import { FaTrash, FaEdit, FaFlag } from 'react-icons/fa';
import { apiRequest } from '../api/backendApi';
import { getProductPricing } from '../utils/pricing';

const REPORT_REASONS = [
    { value: 'fake_product',      label: 'Fake / counterfeit product' },
    { value: 'wrong_expiry',      label: 'Wrong expiry date listed' },
    { value: 'misleading_price',  label: 'Misleading price' },
    { value: 'poor_quality',      label: 'Poor quality / damaged' },
    { value: 'already_expired',   label: 'Product already expired' },
    { value: 'other',             label: 'Other' },
];

const ProductCard = ({ product, isOwner, onDelete, isAdmin, onAdminDelete }) => {
    // Hooks must be called unconditionally on every render
    const [showReport, setShowReport]     = useState(false);
    const [reason, setReason]             = useState('fake_product');
    const [description, setDescription]  = useState('');
    const [reporting, setReporting]       = useState(false);
    const [reported, setReported]         = useState(false);

    if (!product) return null;

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

    const pricing = getProductPricing(product);

    const distNum = product.distance != null ? Number(product.distance) : null;
    const hasValidDistance = distNum != null && !isNaN(distNum);

    const isExpired = product.isExpired || product.expiryStatus === 'Expired';
    const isNearExpiry = product.expiryStatus === 'Near Expiry' || product.expiryStatus === 'Expiring Soon';

    return (
        <Card className="listing-card google-skill-card">
            <div className="google-card-accent-bar" />
            {/* Product image */}
            <Link to={`/product/${product.id}`} style={{ display: 'block', color: 'inherit' }}>
                <div className="listing-image-container">
                    <img
                        src={product.image || 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=600&q=80'}
                        alt={product.name || 'Product'}
                        className="card-image"
                        loading="lazy"
                        decoding="async"
                        onError={e => { e.target.onerror = null; e.target.src = 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=600&q=80'; }}
                    />
                    <span
                        className="expiry-tag"
                        style={{
                            backgroundColor: isExpired
                                ? 'rgba(220, 38, 38, 0.9)'
                                : isNearExpiry
                                ? 'rgba(217, 119, 6, 0.9)'
                                : 'rgba(16, 185, 129, 0.9)',
                            color: '#ffffff',
                            fontWeight: 700
                        }}
                    >
                        {isExpired ? '⚠️ Expired: ' : 'Expires: '}{product.expiry || 'N/A'}
                    </span>
                    {hasValidDistance && (
                        <span className="distance-tag">{distNum.toFixed(1)} km away</span>
                    )}
                    {pricing.hasSavings && (
                        <span className="discount-ribbon" aria-hidden="true">
                            {pricing.ribbonLabel}
                        </span>
                    )}
                </div>
            </Link>

            {/* Product details */}
            <div className="listing-details">
                <Link to={`/product/${product.id}`} style={{ display: 'block', color: 'inherit' }}>
                    <div style={{ marginBottom: '0.35rem', display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '0.72rem', fontWeight: '800', color: 'var(--primary)', background: 'rgba(99, 102, 241, 0.14)', padding: '2px 7px', borderRadius: '6px', display: 'inline-block' }}>
                            Item ID: {product.product_item_id || `#${product.id}`}
                        </span>
                        {product.expiryStatus && (
                            <span style={{
                                fontSize: '0.72rem',
                                fontWeight: '700',
                                padding: '2px 7px',
                                borderRadius: '6px',
                                backgroundColor: isExpired ? 'rgba(239, 68, 68, 0.15)' : isNearExpiry ? 'rgba(245, 158, 11, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                                color: isExpired ? '#dc2626' : isNearExpiry ? '#d97706' : '#059669'
                            }}>
                                {product.expiryStatus}
                            </span>
                        )}
                    </div>
                    <h3 className="card-title">{product.name}</h3>
                    <p className="card-subtitle">{product.location}</p>
                    <div className="price-row">
                        <span className="current-price">{pricing.formattedSelling || `₹${product.price}`}</span>
                        {pricing.hasSavings && (
                            <span className="original-price">{pricing.formattedMrp}</span>
                        )}
                    </div>
                    {pricing.hasSavings && (
                        <p className="savings-badge" aria-label={pricing.ariaLabel}>
                            {pricing.savingsLabel}
                        </p>
                    )}
                    {!pricing.hasSavings && <div className="savings-badge-placeholder" aria-hidden="true" />}
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
                            onClick={e => { e.preventDefault(); e.stopPropagation(); if (isAdmin && onAdminDelete) onAdminDelete(product.id); else if (onDelete) onDelete(product.id); }}
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
                                        className="report-fraud-form"
                                        onClick={e => e.stopPropagation()}
                                        onSubmit={handleReport}
                                    >
                                        <p className="report-form-title">🚩 Flag this listing for admin review</p>

                                        <label htmlFor={`reason-${product.id}`}>Reason for reporting</label>
                                        <select
                                            id={`reason-${product.id}`}
                                            value={reason}
                                            onChange={e => setReason(e.target.value)}
                                        >
                                            {REPORT_REASONS.map(r => (
                                                <option key={r.value} value={r.value}>{r.label}</option>
                                            ))}
                                        </select>

                                        <label htmlFor={`desc-${product.id}`}>Additional details (optional)</label>
                                        <textarea
                                            id={`desc-${product.id}`}
                                            rows={2}
                                            value={description}
                                            onChange={e => setDescription(e.target.value)}
                                            placeholder="Provide more context for admins..."
                                            maxLength={500}
                                        />

                                        <div className="report-form-actions">
                                            <button
                                                type="button"
                                                className="report-cancel-btn"
                                                onClick={() => setShowReport(false)}
                                            >
                                                Cancel
                                            </button>
                                            <button
                                                type="submit"
                                                className="report-submit-btn"
                                                disabled={reporting}
                                            >
                                                {reporting ? 'Submitting...' : 'Submit Report'}
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
