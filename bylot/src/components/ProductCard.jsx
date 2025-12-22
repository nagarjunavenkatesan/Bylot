import React from 'react';
import { Link } from 'react-router-dom';
import Card from './Card';
import Button from './Button';
import { FaTrash, FaEdit } from 'react-icons/fa';

const ProductCard = ({ product, isOwner, onDelete }) => {
    return (
        <Card className="listing-card">
            <div className="listing-image-container">
                <img src={product.image} alt={product.name} className="card-image" />
                <span className="expiry-tag">Expires: {product.expiry}</span>
                <span className="distance-tag">{product.distance} km away</span>
                {isOwner && (
                    <div className="owner-actions" style={{ position: 'absolute', top: '10px', right: '10px', display: 'flex', gap: '5px' }}>
                        <Link to={`/edit-item/${product.id}`}>
                            <button className="icon-btn edit-btn" style={{ background: 'white', border: 'none', borderRadius: '50%', padding: '8px', cursor: 'pointer', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
                                <FaEdit color="var(--primary)" />
                            </button>
                        </Link>
                        <button 
                            className="icon-btn delete-btn" 
                            onClick={() => onDelete(product.id)}
                            style={{ background: 'white', border: 'none', borderRadius: '50%', padding: '8px', cursor: 'pointer', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}
                        >
                            <FaTrash color="red" />
                        </button>
                    </div>
                )}
            </div>
            <div className="listing-details">
                <h3 className="card-title">{product.name}</h3>
                <p className="card-subtitle">{product.location}</p>
                <div className="price-row">
                    <span className="current-price">₹{product.price}</span>
                    {product.originalPrice && <span className="original-price">₹{product.originalPrice}</span>}
                </div>
                {!isOwner && (
                    <Link to={`/product/${product.id}`} className="w-full">
                        <Button variant="primary" className="w-full">View Deal</Button>
                    </Link>
                )}
                {isOwner && (
                     <Link to={`/product/${product.id}`} className="w-full">
                        <Button variant="outline" className="w-full">View Details</Button>
                    </Link>
                )}
            </div>
        </Card>
    );
};

export default ProductCard;
