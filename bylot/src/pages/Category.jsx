import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import PageTransition from '../components/PageTransition';
import SEOHead from '../components/SEOHead';
import ProductCard from '../components/ProductCard';
import Loader from '../components/Loader';
import { fetchProducts } from '../api/backendApi';
import { categorySEO, slugToTitle, itemListSEO } from '../utils/seo';
import '../styles/Browse.css';

const CATEGORY_SLUG_MAP = {
    'groceries': 'Daily Essentials',
    'daily-essentials': 'Daily Essentials',
    'near-expiry': 'Near Expiry',
    'discount-products': 'Discount Products',
    'dairy': 'Dairy',
    'vegetables': 'Vegetables',
    'fruits': 'Fruits',
    'bakery': 'Bakery',
    'corporate-clearance': 'Corporate Clearance'
};

const Category = () => {
    const { slug } = useParams();
    const formattedSlug = (slug || '').toLowerCase();
    const categoryName = CATEGORY_SLUG_MAP[formattedSlug] || slugToTitle(formattedSlug);

    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);

    const loadCategoryProducts = useCallback(async () => {
        setLoading(true);
        try {
            const allProducts = await fetchProducts();
            const filtered = (Array.isArray(allProducts) ? allProducts : []).filter(p => {
                if (!p) return false;
                if (!p.category) return true;
                return p.category.toLowerCase() === categoryName.toLowerCase();
            });
            setProducts(filtered);
        } catch (err) {
            console.error('Error fetching category products:', err);
            setProducts([]);
        } finally {
            setLoading(false);
        }
    }, [categoryName]);

    useEffect(() => {
        loadCategoryProducts();
    }, [loadCategoryProducts]);

    const seoProps = categorySEO(categoryName, formattedSlug, products.length);

    if (products.length > 0) {
        seoProps.structuredData = [
            seoProps.structuredData,
            itemListSEO(products, `${categoryName} Products on Bylot`)
        ];
    }

    return (
        <PageTransition>
            <SEOHead {...seoProps} />
            <div className="container" style={{ padding: '2rem 1rem', minHeight: '80vh' }}>
                <nav aria-label="Breadcrumb" style={{ marginBottom: '1.5rem', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                    <Link to="/" style={{ color: 'var(--primary)', textDecoration: 'none' }}>Home</Link>
                    <span style={{ margin: '0 0.5rem' }}>/</span>
                    <Link to="/browse" style={{ color: 'var(--primary)', textDecoration: 'none' }}>Categories</Link>
                    <span style={{ margin: '0 0.5rem' }}>/</span>
                    <span style={{ fontWeight: 600 }}>{categoryName}</span>
                </nav>

                <header style={{ marginBottom: '2rem' }}>
                    <h1 className="section-title" style={{ fontSize: '2.25rem', marginBottom: '0.5rem' }}>
                        {categoryName} Deals &amp; Near-Expiry Items
                    </h1>
                    <p style={{ color: 'var(--text-muted)', fontSize: '1.05rem', maxWidth: '800px', lineHeight: '1.6' }}>
                        Explore verified surplus stock, discounted {categoryName.toLowerCase()}, and near-expiry essentials from local sellers. Save up to 70% off MRP while preventing food waste in your community.
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
                        <h3>No items listed in {categoryName} right now.</h3>
                        <p style={{ color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                            Check back soon or browse all deals across other categories.
                        </p>
                        <div style={{ marginTop: '1.5rem' }}>
                            <Link to="/browse" className="btn btn-primary">Browse All Deals</Link>
                        </div>
                    </div>
                )}
            </div>
        </PageTransition>
    );
};

export default Category;
