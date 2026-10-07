import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import PageTransition from '../components/PageTransition';
import SEOHead from '../components/SEOHead';
import ProductCard from '../components/ProductCard';
import Loader from '../components/Loader';
import { fetchProducts } from '../api/backendApi';
import { locationSEO, slugToTitle, itemListSEO } from '../utils/seo';
import '../styles/Browse.css';

const Location = () => {
    const { city, category } = useParams();
    const citySlug = (city || 'bengaluru').toLowerCase();
    const cityName = slugToTitle(citySlug);
    const categoryName = category ? slugToTitle(category) : '';

    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);

    const loadLocationProducts = useCallback(async () => {
        setLoading(true);
        try {
            const allProducts = await fetchProducts();
            const filtered = (Array.isArray(allProducts) ? allProducts : []).filter(p => {
                if (!p) return false;
                const locMatch = !p.location || p.location.toLowerCase().includes(citySlug) || citySlug.includes((p.location || '').toLowerCase());
                const catMatch = !categoryName || (p.category && p.category.toLowerCase() === categoryName.toLowerCase());
                return locMatch && catMatch;
            });
            setProducts(filtered);
        } catch (err) {
            console.error('Error fetching location products:', err);
            setProducts([]);
        } finally {
            setLoading(false);
        }
    }, [citySlug, categoryName]);

    useEffect(() => {
        loadLocationProducts();
    }, [loadLocationProducts]);

    const seoProps = locationSEO(cityName, citySlug, categoryName);

    if (products.length > 0) {
        const itemSchema = itemListSEO(products, `Discounted Items in ${cityName}`);
        if (Array.isArray(seoProps.structuredData)) {
            seoProps.structuredData.push(itemSchema);
        } else if (seoProps.structuredData) {
            seoProps.structuredData = [seoProps.structuredData, itemSchema];
        }
    }

    return (
        <PageTransition>
            <SEOHead {...seoProps} />
            <div className="container" style={{ padding: '2rem 1rem', minHeight: '80vh' }}>
                <nav aria-label="Breadcrumb" style={{ marginBottom: '1.5rem', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                    <Link to="/" style={{ color: 'var(--primary)', textDecoration: 'none' }}>Home</Link>
                    <span style={{ margin: '0 0.5rem' }}>/</span>
                    <Link to="/browse" style={{ color: 'var(--primary)', textDecoration: 'none' }}>Locations</Link>
                    <span style={{ margin: '0 0.5rem' }}>/</span>
                    <Link to={`/location/${citySlug}`} style={{ color: 'var(--primary)', textDecoration: 'none' }}>{cityName}</Link>
                    {categoryName && (
                        <>
                            <span style={{ margin: '0 0.5rem' }}>/</span>
                            <span style={{ fontWeight: 600 }}>{categoryName}</span>
                        </>
                    )}
                </nav>

                <header style={{ marginBottom: '2rem' }}>
                    <h1 className="section-title" style={{ fontSize: '2.25rem', marginBottom: '0.5rem' }}>
                        {categoryName ? `${categoryName} in ${cityName}` : `Near-Expiry & Discount Stores in ${cityName}`}
                    </h1>
                    <p style={{ color: 'var(--text-muted)', fontSize: '1.05rem', maxWidth: '800px', lineHeight: '1.6' }}>
                        Browse hyperlocal deals, near-expiry food items, bakery surplus, and discounted provisions from verified local vendors in {cityName}.
                    </p>
                </header>

                {loading ? (
                    <Loader />
                ) : products.length > 0 ? (
                    <div className="product-grid">
                        {products.map(product => (
                            <ProductCard key={product.id} product={product} />
                        ))}
                    </div>
                ) : (
                    <div className="card" style={{ padding: '3rem', textAlign: 'center' }}>
                        <h3>No active listings found for {cityName}{categoryName ? ` (${categoryName})` : ''}.</h3>
                        <p style={{ color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                            Browse nearby deals across all available locations on Bylot.
                        </p>
                        <div style={{ marginTop: '1.5rem' }}>
                            <Link to="/browse" className="btn btn-primary">Explore All Locations</Link>
                        </div>
                    </div>
                )}
            </div>
        </PageTransition>
    );
};

export default Location;
