import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import Card from './Card';
import { FaTrash, FaEdit, FaFlag } from 'react-icons/fa';
import { apiRequest, getAccessToken, deleteProduct } from '../api/backendApi';
import { useAuth } from '../context/AuthContext';
import { getProductPricing } from '../utils/pricing';
import { formatCardExpiry } from '../utils/expiry';

const REPORT_REASONS = [
    { value: 'fake_product',      label: 'Fake / counterfeit product' },
    { value: 'wrong_expiry',      label: 'Wrong expiry date listed' },
    { value: 'misleading_price',  label: 'Misleading price' },
    { value: 'poor_quality',      label: 'Poor quality / damaged' },
    { value: 'already_expired',   label: 'Product already expired' },
    { value: 'other',             label: 'Other' },
];

const ProductCard = ({ product, isOwner, onDelete, isAdmin, onAdminDelete, topHeader, isSelected = false, className = '' }) => {
    const auth = useAuth();
    const user = auth?.user || null;

    // Hooks must be called unconditionally on every render
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [isDeleting, setIsDeleting]           = useState(false);
    const [showReport, setShowReport]           = useState(false);
    const [reason, setReason]                   = useState('fake_product');
    const [description, setDescription]        = useState('');
    const [reporting, setReporting]             = useState(false);
    const [reported, setReported]               = useState(false);

    if (!product) return null;

    const handleReport = async (e) => {
        e.preventDefault();
        e.stopPropagation();

        const token = getAccessToken();
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
    const expiryDetails = formatCardExpiry(product);

    const distNum = product.distance != null ? Number(product.distance) : null;
    const hasValidDistance = distNum != null && !isNaN(distNum);

    const isExpired = Boolean(
        expiryDetails?.isExpired ||
        product.isExpired ||
        product.expiryStatus === 'Expired' ||
        product.status === 'expired'
    );
    const isNearExpiry = !isExpired && (product.expiryStatus === 'Near Expiry' || product.expiryStatus === 'Expiring Soon');

    return (
        <Card className={`listing-card google-skill-card ${isSelected ? 'is-selected' : ''} ${className}`.trim()}>
            <div className="google-card-accent-bar" />

            {/* Integrated Top Header (e.g. Admin selection checkbox & Product ID) */}
            {topHeader && (
                <div className="card-top-header">
                    {topHeader}
                </div>
            )}

            {/* Product image */}
            <Link to={`/product/${product.id}`} style={{ display: 'block', color: 'inherit' }}>
                <div className="listing-image-container">
                    <img
                        src={(product.image || '').includes('.webp') && !(product.image || '').includes('_thumb.webp') ? product.image.replace('.webp', '_thumb.webp') : (product.image || 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=600&q=80')}
                        alt={product.name ? `Buy ${product.name} near-expiry deal` : 'Product image'}
                        className="card-image"
                        width="300"
                        height="225"
                        loading="lazy"
                        decoding="async"
                        onError={e => {
                            if (e.target.src.includes('_thumb.webp')) {
                                e.target.src = product.image;
                            } else {
                                e.target.onerror = null;
                                e.target.src = 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=600&q=80';
                            }
                        }}
                    />

                    {/* Compact Image Overlay Badges (never overlap date or each other) */}
                    <div className="card-image-overlays">
                        {isExpired ? (
                            <span className="compact-expired-badge" aria-label="Product is expired">
                                ⚠ Expired
                            </span>
                        ) : isNearExpiry ? (
                            <span className="compact-expiry-badge near-expiry">
                                ⚠ Expiring Soon
                            </span>
                        ) : (
                            <span className="compact-expiry-badge fresh">
                                {product.expiryStatus || 'Fresh'}
                            </span>
                        )}

                        {pricing.hasSavings && (
                            <span className="discount-ribbon" aria-hidden="true">
                                {pricing.ribbonLabel}
                            </span>
                        )}
                    </div>

                    {hasValidDistance && (
                        <span className="distance-tag">{distNum.toFixed(1)} km away</span>
                    )}
                </div>
            </Link>

            {/* Product details */}
            <div className="listing-details">
                <Link to={`/product/${product.id}`} style={{ display: 'block', color: 'inherit' }}>
                    {/* Item ID and Expired Status */}
                    <div className="card-meta-row">
                        <span className="card-item-id">
                            Item ID: {product.product_item_id || `#${product.id}`}
                        </span>
                        {product.expiryStatus && (
                            <span className={`card-status-pill ${isExpired ? 'expired' : isNearExpiry ? 'near-expiry' : 'fresh'}`}>
                                {product.expiryStatus}
                            </span>
                        )}
                    </div>

                    {/* Product Name */}
                    <h3 className="card-title">{product.name}</h3>

                    {/* Seller / Location */}
                    <p className="card-subtitle">
                        {product.location || (product.seller_name ? `Available from ${product.seller_name}` : 'Available from Bylot seller')}
                    </p>

                    {/* Expiry Details Section (Always visible, prominently styled for expired products) */}
                    {expiryDetails?.formattedDate && (
                        <div className={`card-expiry-block ${isExpired ? 'is-expired' : ''}`}>
                            <div className="card-expiry-row">
                                <span className="card-expiry-label">Expiry date:</span>
                                <strong className="card-expiry-date">{expiryDetails.formattedDate}</strong>
                            </div>
                            {expiryDetails.relativeLabel && (
                                <div className="card-expiry-relative">
                                    {expiryDetails.relativeLabel}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Price Row */}
                    <div className="price-row">
                        <span className="current-price">{pricing.formattedSelling || `₹${product.price}`}</span>
                        {pricing.hasSavings && (
                            <span className="original-price">{pricing.formattedMrp}</span>
                        )}
                    </div>

                    {/* Savings Badge */}
                    {pricing.hasSavings && (
                        <p className="savings-badge" aria-label={pricing.ariaLabel}>
                            {pricing.savingsLabel}
                        </p>
                    )}
                    {!pricing.hasSavings && <div className="savings-badge-placeholder" aria-hidden="true" />}
                </Link>

                {/* Owner / Admin actions */}
                {(() => {
                    const isSellerOwner = Boolean(
                        user &&
                        (user.role === 'seller' || user.role === 'admin') &&
                        (
                            isOwner ||
                            (product.seller_user_id != null && Number(user.id) === Number(product.seller_user_id)) ||
                            (product.seller_id != null && user.seller_id != null && Number(user.seller_id) === Number(product.seller_id))
                        )
                    );
                    const isAuthorizedAdmin = Boolean(isAdmin && user && user.role === 'admin');
                    const canDelete = isSellerOwner || isAuthorizedAdmin;

                    const handleConfirmDelete = async (e) => {
                        if (e) {
                            e.preventDefault();
                            e.stopPropagation();
                        }
                        setIsDeleting(true);
                        try {
                            if (isAuthorizedAdmin && onAdminDelete) {
                                await onAdminDelete(product.id, product.name);
                            } else if (onDelete) {
                                await onDelete(product.id);
                            } else {
                                await deleteProduct(product.id);
                                alert('Item deleted successfully.');
                            }
                            setShowDeleteModal(false);
                        } catch (err) {
                            alert(err.message || 'Failed to delete item.');
                        } finally {
                            setIsDeleting(false);
                        }
                    };

                    if (canDelete) {
                        return (
                            <>
                                <div className="owner-actions" style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                                    {isSellerOwner && (
                                        <Link to={`/edit-item/${product.id}`} className="w-full">
                                            <button className="btn btn-secondary w-full" style={{ padding: '6px 12px', fontSize: '0.85rem' }}>
                                                <FaEdit style={{ marginRight: '5px' }} /> Edit
                                            </button>
                                        </Link>
                                    )}
                                    <button
                                        type="button"
                                        className="btn btn-danger w-full"
                                        onClick={e => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            setShowDeleteModal(true);
                                        }}
                                        style={{ padding: '8px 14px', fontSize: '0.85rem', borderRadius: 'var(--radius-full)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                                    >
                                        <FaTrash /> Delete Item
                                    </button>
                                </div>

                                {/* Delete Confirmation Modal */}
                                {showDeleteModal && (
                                    <div
                                        className="delete-item-modal-overlay"
                                        onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            if (!isDeleting) setShowDeleteModal(false);
                                        }}
                                        role="presentation"
                                        style={{
                                            position: 'fixed',
                                            top: 0,
                                            left: 0,
                                            right: 0,
                                            bottom: 0,
                                            backgroundColor: 'rgba(0, 0, 0, 0.65)',
                                            backdropFilter: 'blur(3px)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            zIndex: 9999,
                                            padding: '1rem'
                                        }}
                                    >
                                        <div
                                            className="delete-item-modal"
                                            onClick={(e) => e.stopPropagation()}
                                            role="dialog"
                                            aria-modal="true"
                                            aria-labelledby={`delete-modal-title-${product.id}`}
                                            style={{
                                                background: 'var(--card-bg, #ffffff)',
                                                color: 'var(--text-color, #1a1a1a)',
                                                borderRadius: '12px',
                                                padding: '1.5rem',
                                                maxWidth: '420px',
                                                width: '100%',
                                                boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.25)',
                                                border: '1px solid var(--border-color, #e5e7eb)'
                                            }}
                                        >
                                            <h3 id={`delete-modal-title-${product.id}`} style={{ margin: '0 0 0.75rem 0', fontSize: '1.15rem', fontWeight: 600 }}>
                                                Are you sure you want to delete this item?
                                            </h3>
                                            <p style={{ margin: '0 0 1.25rem 0', color: 'var(--text-muted, #64748b)', fontSize: '0.9rem', lineHeight: 1.5 }}>
                                                "{product.name}" will be removed from active marketplace listings. Its historical data will be preserved in encrypted 30-day reports.
                                            </p>
                                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                                                <button
                                                    type="button"
                                                    className="btn btn-secondary"
                                                    onClick={(e) => {
                                                        e.preventDefault();
                                                        e.stopPropagation();
                                                        setShowDeleteModal(false);
                                                    }}
                                                    disabled={isDeleting}
                                                    style={{ padding: '0.5rem 1rem', fontSize: '0.875rem' }}
                                                >
                                                    Cancel
                                                </button>
                                                <button
                                                    type="button"
                                                    className="btn btn-danger"
                                                    onClick={handleConfirmDelete}
                                                    disabled={isDeleting}
                                                    style={{ padding: '0.5rem 1rem', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '6px' }}
                                                >
                                                    <FaTrash /> {isDeleting ? 'Deleting...' : 'Delete'}
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </>
                        );
                    }

                    return null;
                })()}

                {/* ── Report Fraud button (shown to non-owners & buyers) ── */}
                {!isOwner && !isAdmin && (!user || (user.role !== 'seller' && user.role !== 'admin')) && (
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
