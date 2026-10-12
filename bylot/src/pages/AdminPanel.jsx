import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FaBoxOpen, FaCalendarTimes, FaChartLine, FaCheckCircle, FaChevronLeft, FaChevronRight, FaExclamationTriangle, FaEye, FaEyeSlash, FaFlag, FaLock, FaMapMarkedAlt, FaSearch, FaStore, FaThLarge, FaThList, FaTrash, FaUsers, FaUserShield } from 'react-icons/fa';
import PageTransition from '../components/PageTransition';
import SEOHead from '../components/SEOHead';
import { pageSEO } from '../utils/seo';
import DistrictAnalytics from '../components/DistrictAnalytics';
import SecurityMcpDashboard from '../components/SecurityMcpDashboard';
import ProductCard from '../components/ProductCard';
import { API_BASE_URL, getAccessToken, normalizeProduct, setAccessToken } from '../api/backendApi';
import { formatCardExpiry } from '../utils/expiry';
import { useAuth } from '../context/AuthContext';
import '../styles/AdminPanel.css';

const adminSEO = pageSEO({
    title: 'Admin Control Center',
    path: '/admin',
    noindex: true,
});


const tabs = [
    { id: 'overview',  label: 'Overview',  icon: FaChartLine },
    { id: 'districts', label: 'Districts', icon: FaMapMarkedAlt },
    { id: 'users',     label: 'Users',     icon: FaUsers },
    { id: 'sellers',   label: 'Sellers',   icon: FaStore },
    { id: 'products',  label: 'Products',  icon: FaBoxOpen },
    { id: 'expired',   label: 'Expired Products', icon: FaCalendarTimes },
    { id: 'reports',   label: 'Reports',   icon: FaFlag },
    { id: 'security',  label: 'Security & MCP', icon: FaUserShield },
];

const productStatuses = ['draft', 'active', 'inactive', 'out_of_stock', 'blocked'];
const userStatuses    = ['active', 'blocked'];

function unwrapList(r) { return Array.isArray(r?.data) ? r.data : []; }

async function adminRequest(path, options = {}) {
    const token = getAccessToken();
    const response = await fetch(`${API_BASE_URL}${path}`, {
        ...options,
        credentials: 'include',
        headers: {
            'Content-Type': 'application/json',
            'X-Bylot-Handshake': localStorage.getItem('bylot-handshake') || '',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...options.headers,
        },
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
        throw new Error(payload.message || `Something went wrong (${response.status})`);
    }
    return payload;
}

// ─── Main Component ────────────────────────────────────────────────────────
const AdminPanel = () => {
    const { user, login, logout } = useAuth();

    const [email, setEmail]           = useState('');
    const [password, setPassword]     = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [activeTab, setActiveTab]   = useState('overview');
    const [query, setQuery]           = useState('');
    const [productIdSearch, setProductIdSearch] = useState('');
    const [productIdResult, setProductIdResult] = useState(null);
    const [productIdLoading, setProductIdLoading] = useState(false);

    useEffect(() => {
        if (!localStorage.getItem('bylot-handshake')) {
            localStorage.setItem('bylot-handshake', Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2));
        }
        if (window.location.hash === '#expired') {
            setActiveTab('expired');
        }
    }, []);

    const [analytics, setAnalytics]         = useState(null);
    const [users, setUsers]                 = useState([]);
    const [sellers, setSellers]             = useState([]);
    const [products, setProducts]           = useState([]);
    const [reports, setReports]             = useState([]);
    const [pendingCount, setPendingCount]   = useState(0);
    const [expiredCount, setExpiredCount]   = useState(0);
    const [districtStats, setDistrictStats] = useState([]);
    const [districtTotals, setDistrictTotals] = useState(null);

    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState('');
    const [error, setError]     = useState('');
    const isAdmin = user?.role === 'admin';

    const loadAdminData = useCallback(async () => {
        if (!isAdmin) return;
        setLoading(true);
        setError('');
        const warnings = [];

        const requests = [
            { key: 'dashboard',    run: () => adminRequest('/api/admin/dashboard') },
            { key: 'districts',    run: () => adminRequest('/api/admin/district-analytics') },
            { key: 'users',        run: () => adminRequest('/api/admin/users?limit=50') },
            { key: 'sellers',      run: () => adminRequest('/api/admin/sellers?limit=50') },
            { key: 'products',     run: () => adminRequest('/api/admin/products?limit=50') },
            { key: 'reports',      run: () => adminRequest('/api/admin/reports?limit=100') },
            { key: 'expiredCount', run: () => adminRequest('/api/admin/products/expired/count') },
        ];

        const results = await Promise.allSettled(requests.map(r => r.run()));
        results.forEach((r, i) => {
            if (r.status === 'rejected') warnings.push(r.reason?.message || `Failed to load ${requests[i].key}`);
        });

        const get = i => results[i].status === 'fulfilled' ? results[i].value : null;
        const [dashboardRes, districtRes, usersRes, sellersRes, productsRes, reportsRes, expiredRes] =
            [0, 1, 2, 3, 4, 5, 6].map(get);

        if (dashboardRes) {
            setAnalytics(dashboardRes.data || null);
            if (dashboardRes.data?.totalExpired !== undefined) {
                setExpiredCount(dashboardRes.data.totalExpired);
            }
        }
        if (expiredRes?.data?.count !== undefined) {
            setExpiredCount(expiredRes.data.count);
        }
        if (districtRes) { setDistrictStats(Array.isArray(districtRes.data) ? districtRes.data : []); setDistrictTotals(districtRes.totals || null); }
        else { setDistrictStats([]); setDistrictTotals(null); }
        if (usersRes)    setUsers(unwrapList(usersRes));
        if (sellersRes)  setSellers(unwrapList(sellersRes));
        if (productsRes) setProducts(unwrapList(productsRes));
        if (reportsRes) {
            const list = unwrapList(reportsRes);
            setReports(list);
            setPendingCount(list.filter(r => r.status === 'pending').length);
        }

        const coreFailed = !dashboardRes && !usersRes && !sellersRes && !productsRes;
        if (coreFailed) setError(warnings[0] || 'Unable to load admin data. Please sign in again.');
        else if (warnings.length) setError(warnings.join(' | '));

        setLoading(false);
    }, [isAdmin]);

    useEffect(() => { loadAdminData(); }, [loadAdminData]);

    const handleLogin = async e => {
        e.preventDefault();
        setLoading(true); setError(''); setMessage('');
        try {
            const payload = await adminRequest('/api/admin/login', { method: 'POST', body: JSON.stringify({ email, password }) });
            const token = payload?.data?.accessToken || payload?.accessToken;
            if (token) {
                setAccessToken(token);
            }
            login({ ...(payload?.data?.user || payload?.user || {}), accessToken: token });
            setPassword('');
            setMessage('Admin login successful.');
        } catch (err) { setError(err.message); }
        finally { setLoading(false); }
    };

    const runAction = async (action, successText) => {
        setLoading(true); setError(''); setMessage('');
        try { await action(); setMessage(successText); await loadAdminData(); }
        catch (err) { setError(err.message); }
        finally { setLoading(false); }
    };

    const handleProductIdSearch = async () => {
        const id = productIdSearch.trim().toUpperCase();
        if (!id) return;
        setProductIdLoading(true); setError(''); setProductIdResult(null);
        try {
            const res = await adminRequest(`/api/admin/products/by-id?product_item_id=${encodeURIComponent(id)}`);
            setProductIdResult(res.data || null);
        } catch (err) {
            setProductIdResult(null);
            setError(err.message);
        } finally {
            setProductIdLoading(false);
        }
    };

    const filteredUsers = useMemo(() => {
        const v = query.toLowerCase();
        return users.filter(i => [i.name, i.email, i.role, i.status].some(f => String(f || '').toLowerCase().includes(v)));
    }, [query, users]);

    const filteredSellers = useMemo(() => {
        const v = query.toLowerCase();
        return sellers.filter(i => [i.business_name, i.name, i.email, i.approval_status, i.status].some(f => String(f || '').toLowerCase().includes(v)));
    }, [query, sellers]);

    const filteredProducts = useMemo(() => {
        const v = query.toLowerCase();
        return products.filter(i => [i.name, i.product_item_id, i.category_name, i.seller_name, i.status].some(f => String(f || '').toLowerCase().includes(v)));
    }, [query, products]);

    const filteredReports = useMemo(() => {
        const v = query.toLowerCase();
        return reports.filter(i => [i.product_name, i.reporter_name, i.reporter_email, i.seller_name, i.reason, i.status]
            .some(f => String(f || '').toLowerCase().includes(v)));
    }, [query, reports]);

    const statCards = [
        { label: 'Customers', value: analytics?.totalUsers    || 0, icon: FaUsers },
        { label: 'Sellers',   value: analytics?.totalSellers  || 0, icon: FaStore },
        { label: 'Products',  value: analytics?.totalProducts || 0, icon: FaBoxOpen },
        { label: 'Expired Products', value: expiredCount, icon: FaCalendarTimes },
        { label: 'Orders',    value: analytics?.totalOrders   || 0, icon: FaCheckCircle },
        { label: 'Revenue',   value: `Rs ${Number(analytics?.revenue || 0).toLocaleString('en-IN')}`, icon: FaChartLine },
        { label: 'Pending Reports', value: pendingCount, icon: FaFlag },
    ];

    if (!isAdmin) {
        return (
            <PageTransition>
                <SEOHead {...adminSEO} />
                <section className="admin-login-page">
                    <div className="admin-login-panel">
                        <div className="admin-login-mark"><FaUserShield /></div>
                        <p className="admin-eyebrow">Bylot control room</p>
                        <h2>Admin sign in</h2>
                        <p className="admin-login-copy">Manage sellers, customers, products, and marketplace activity from one clean workspace.</p>
                        <form onSubmit={handleLogin} className="admin-login-form">
                            <label htmlFor="admin-email">Email</label>
                            <input id="admin-email" className="form-input" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="admin@example.com" required />
                            <label htmlFor="admin-password">Password</label>
                            <div className="admin-password-wrap">
                                <input id="admin-password" className="form-input" type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="Enter admin password" required />
                                <button type="button" className="admin-eye-btn" onClick={() => setShowPassword(p => !p)} aria-label={showPassword ? 'Hide password' : 'Show password'}>
                                    {showPassword ? <FaEyeSlash /> : <FaEye />}
                                </button>
                            </div>
                            <input type="text" name="_hp" tabIndex={-1} autoComplete="off" style={{ position: 'absolute', left: '-9999px' }} />
                            {error && <p className="admin-alert error">{error}</p>}
                            <button className="btn btn-glow admin-submit" type="submit" disabled={loading}>
                                <FaLock />{loading ? 'Signing in...' : 'Sign in'}
                            </button>
                        </form>
                    </div>
                </section>
            </PageTransition>
        );
    }

    return (
        <PageTransition>
            <SEOHead {...adminSEO} />
            <section className="admin-page">
                <div className="container">
                    <div className="admin-hero">
                        <div>
                            <p className="admin-eyebrow">Admin workspace</p>
                            <h2>Bylot dashboard</h2>
                            <p>Track marketplace health, approve sellers, and keep listings tidy.</p>
                        </div>
                        <button className="btn btn-secondary" onClick={logout}>Sign out</button>
                    </div>

                    {/* Tabs */}
                    <div className="admin-tabs" role="tablist" aria-label="Admin sections">
                        {tabs.map(tab => {
                            const Icon = tab.icon;
                            const isReports = tab.id === 'reports';
                            const isExpired = tab.id === 'expired';
                            const badge = (isReports && pendingCount > 0) || (isExpired && expiredCount > 0);
                            const badgeNum = isReports ? pendingCount : expiredCount;
                            return (
                                <button key={tab.id} className={`admin-tab ${activeTab === tab.id ? 'active' : ''}`}
                                    onClick={() => setActiveTab(tab.id)} type="button">
                                    <Icon />{tab.label}
                                    {badge && <span className="admin-tab-badge">{badgeNum}</span>}
                                </button>
                            );
                        })}
                    </div>

                    {(message || error) && <p className={`admin-alert ${error ? 'error' : 'success'}`}>{error || message}</p>}
                    {loading && <p className="admin-loading">Refreshing admin data...</p>}

                    {/* Overview */}
                    {activeTab === 'overview' && (
                        <div className="admin-stats-grid">
                            {statCards.map(card => {
                                const Icon = card.icon;
                                return (
                                    <article className="admin-stat" key={card.label}>
                                        <span className="admin-stat-icon"><Icon /></span>
                                        <span>{card.label}</span>
                                        <strong>{card.value}</strong>
                                    </article>
                                );
                            })}
                        </div>
                    )}

                    {activeTab === 'districts' && <DistrictAnalytics rows={districtStats} totals={districtTotals} loading={loading} />}
                    {activeTab === 'security' && <SecurityMcpDashboard />}

                    {!['overview', 'districts', 'reports', 'security', 'expired'].includes(activeTab) && (
                        <AdminSearch activeTab={activeTab} query={query} setQuery={setQuery} />
                    )}

                    {/* Users */}
                    {activeTab === 'users' && (
                        <AdminTable emptyText="No users found."
                            columns={['Name', 'Email', 'Role', 'Status', 'Action']}
                            rows={filteredUsers.map(item => [
                                item.name, item.email, item.role,
                                <StatusPill status={item.status} />,
                                <select value={item.status} onChange={e => runAction(() => adminRequest(`/api/admin/users/${item.id}/status`, { method: 'PATCH', body: JSON.stringify({ status: e.target.value }) }), 'User status updated.')}>
                                    {userStatuses.map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                            ])}
                        />
                    )}

                    {/* Sellers */}
                    {activeTab === 'sellers' && (
                        <AdminTable emptyText="No sellers found."
                            columns={['Business', 'Owner', 'Approval', 'Status', 'Action']}
                            rows={filteredSellers.map(item => [
                                item.business_name, item.name || item.email,
                                <StatusPill status={item.approval_status} />,
                                <StatusPill status={item.status} />,
                                <div className="admin-action-row">
                                    <button type="button" className="admin-mini-btn approve" onClick={() => runAction(() => adminRequest(`/api/admin/sellers/${item.id}/approve`, { method: 'PATCH', body: JSON.stringify({ approvalStatus: 'approved' }) }), 'Seller approved.')}>Approve</button>
                                    <button type="button" className="admin-mini-btn reject" onClick={() => runAction(() => adminRequest(`/api/admin/sellers/${item.id}/approve`, { method: 'PATCH', body: JSON.stringify({ approvalStatus: 'rejected' }) }), 'Seller rejected.')}>Reject</button>
                                </div>
                            ])}
                        />
                    )}

                    {/* Products */}
                    {activeTab === 'products' && (
                        <>
                            <div className="admin-id-search">
                                <div className="admin-id-search-input">
                                    <FaSearch />
                                    <input value={productIdSearch} onChange={e => setProductIdSearch(e.target.value)}
                                        placeholder="Search by Product ID or DB ID (e.g. PRD-XXXXXX or 145)"
                                        onKeyDown={e => { if (e.key === 'Enter') handleProductIdSearch(); }} />
                                    <button type="button" className="admin-id-search-btn" onClick={handleProductIdSearch} disabled={productIdLoading}>
                                        {productIdLoading ? 'Searching...' : 'Find Product'}
                                    </button>
                                </div>
                                {productIdResult && (
                                    <div className="admin-id-result">
                                        <div className="admin-id-result-header">
                                            <div>
                                                <span className="admin-product-id" style={{ fontSize: '1rem', marginRight: '0.75rem' }}>
                                                    {productIdResult.product_item_id || `ID #${productIdResult.id}`}
                                                </span>
                                                <small style={{ color: 'var(--text-muted)' }}>(Database ID: #{productIdResult.id})</small>
                                            </div>
                                            <StatusPill status={productIdResult.status} />
                                        </div>
                                        <div className="admin-id-result-body">
                                            <div><strong>{productIdResult.name}</strong></div>
                                            <div>Seller: {productIdResult.seller_name || 'Store'} | Category: {productIdResult.category_name || 'General'}</div>
                                            <div>Price: Rs {Number(productIdResult.selling_price || 0).toLocaleString('en-IN')} {productIdResult.mrp ? `(MRP: Rs ${Number(productIdResult.mrp).toLocaleString('en-IN')})` : ''}</div>
                                            <div>Stock: {productIdResult.stock_quantity ?? 0} units</div>
                                        </div>
                                        <div className="admin-id-result-actions" style={{ flexWrap: 'wrap', gap: '0.6rem' }}>
                                            <a href={`/product/${productIdResult.id}`} target="_blank" rel="noopener noreferrer" className="admin-mini-btn" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', textDecoration: 'none' }}>
                                                <FaEye /> Access Product
                                            </a>
                                            <a href={`/edit-item/${productIdResult.id}`} target="_blank" rel="noopener noreferrer" className="admin-mini-btn" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', textDecoration: 'none' }}>
                                                <FaLock /> Edit
                                            </a>
                                            <select value={productIdResult.status} onChange={e => runAction(async () => {
                                                await adminRequest(`/api/admin/products/${productIdResult.id}/status`, { method: 'PATCH', body: JSON.stringify({ status: e.target.value }) });
                                                setProductIdResult(prev => ({ ...prev, status: e.target.value }));
                                            }, 'Product status updated.')}>
                                                {productStatuses.map(s => <option key={s} value={s}>{s}</option>)}
                                            </select>
                                            <button type="button" className="admin-mini-btn reject" onClick={() => {
                                                if (window.confirm(`Are you sure you want to delete "${productIdResult.name}"?`)) {
                                                    runAction(async () => {
                                                        await adminRequest(`/api/admin/products/${productIdResult.id}`, { method: 'DELETE' });
                                                        setProductIdResult(null);
                                                        setProductIdSearch('');
                                                    }, 'Product deleted successfully.');
                                                }
                                            }}>
                                                <FaTrash /> Delete Product
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                            <AdminTable emptyText="No products found."
                                columns={['Product ID', 'Product', 'Seller', 'Price', 'Status', 'Actions']}
                                rows={filteredProducts.map(item => [
                                    <span className="admin-product-id">{item.product_item_id || `#${item.id}`}</span>,
                                    item.name,
                                    item.seller_name || item.category_name,
                                    `Rs ${Number(item.selling_price || item.price || 0).toLocaleString('en-IN')}`,
                                    <StatusPill status={item.status} />,
                                    <div className="admin-action-row">
                                        <a href={`/product/${item.id}`} target="_blank" rel="noopener noreferrer" className="admin-icon-btn" aria-label={`Access ${item.name}`} title="View/Access Product" style={{ display: 'inline-grid', placeItems: 'center', textDecoration: 'none' }}>
                                            <FaEye />
                                        </a>
                                        <select value={item.status} onChange={e => runAction(() => adminRequest(`/api/admin/products/${item.id}/status`, { method: 'PATCH', body: JSON.stringify({ status: e.target.value }) }), 'Product status updated.')}>
                                            {productStatuses.map(s => <option key={s} value={s}>{s}</option>)}
                                        </select>
                                        <button type="button" className="admin-icon-btn danger" aria-label={`Delete ${item.name}`} title="Delete Product"
                                            onClick={() => {
                                                if (window.confirm(`Delete product "${item.name}"?`)) {
                                                    runAction(() => adminRequest(`/api/admin/products/${item.id}`, { method: 'DELETE' }), 'Product deleted successfully.');
                                                }
                                            }}>
                                            <FaTrash />
                                        </button>
                                    </div>
                                ])}
                            />
                        </>
                    )}

                    {/* ── Expired Products Tab ── */}
                    {activeTab === 'expired' && (
                        <ExpiredProductsTab
                            adminRequest={adminRequest}
                            authoritativeExpiredCount={expiredCount}
                            setAuthoritativeExpiredCount={setExpiredCount}
                            refreshAdminData={loadAdminData}
                        />
                    )}

                    {/* ── Fraud Reports Tab ── */}
                    {activeTab === 'reports' && (
                        <FraudReportsTab
                            reports={filteredReports}
                            allReports={reports}
                            query={query}
                            setQuery={setQuery}
                            runAction={runAction}
                            adminRequest={adminRequest}
                        />
                    )}
                </div>
            </section>
        </PageTransition>
    );
};

// ─── Fraud Reports Section ─────────────────────────────────────────────────
function FraudReportsTab({ reports, allReports, query, setQuery, runAction, adminRequest }) {
    const [filterStatus, setFilterStatus] = useState('all');
    const [noteInput, setNoteInput]        = useState({});

    const pendingCount  = allReports.filter(r => r.status === 'pending').length;
    const reviewedCount = allReports.filter(r => r.status === 'reviewed').length;
    const resolvedCount = allReports.filter(r => r.status === 'resolved').length;
    const dismissedCount= allReports.filter(r => r.status === 'dismissed').length;

    const displayed = filterStatus === 'all'
        ? reports
        : reports.filter(r => r.status === filterStatus);

    const reasonLabel = {
        fake_product:     'Fake product',
        wrong_expiry:     'Wrong expiry',
        misleading_price: 'Misleading price',
        poor_quality:     'Poor quality',
        already_expired:  'Already expired',
        other:            'Other',
    };

    return (
        <div className="admin-reports-section">
            {/* Summary cards */}
            <div className="reports-summary">
                {[
                    { label: 'Pending',   count: pendingCount,   color: '#b45309',  bg: 'rgba(245,158,11,0.12)' },
                    { label: 'Reviewed',  count: reviewedCount,  color: '#4F46E5',  bg: 'rgba(99,102,241,0.12)' },
                    { label: 'Resolved',  count: resolvedCount,  color: '#047857',  bg: 'rgba(16,185,129,0.12)' },
                    { label: 'Dismissed', count: dismissedCount, color: '#64748b',  bg: 'rgba(100,116,139,0.10)' },
                ].map(s => (
                    <button key={s.label}
                        className={`report-summary-card ${filterStatus === s.label.toLowerCase() ? 'active-filter' : ''}`}
                        style={{ '--rc': s.color, '--rbg': s.bg }}
                        onClick={() => setFilterStatus(p => p === s.label.toLowerCase() ? 'all' : s.label.toLowerCase())}
                    >
                        <strong>{s.count}</strong>
                        <span>{s.label}</span>
                    </button>
                ))}
            </div>

            {/* Search bar */}
            <div className="admin-toolbar" style={{ marginTop: '1rem' }}>
                <FaSearch />
                <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search reports by product, reporter, seller…" />
            </div>

            {/* Report cards */}
            {displayed.length === 0 ? (
                <div className="admin-empty">No reports found.</div>
            ) : (
                <div className="report-cards">
                    {displayed.map(rpt => (
                        <article key={rpt.id} className={`report-card report-card--${rpt.status}`}>
                            {/* Header */}
                            <div className="report-card-header">
                                <div className="report-card-product">
                                    {rpt.product_image && (
                                        <img
                                            src={rpt.product_image.startsWith('http') ? rpt.product_image : `${API_BASE_URL}/${String(rpt.product_image).replace(/^\/+/, '')}`}
                                            alt={rpt.product_name}
                                            className="report-product-thumb"
                                            onError={e => { e.target.style.display = 'none'; }}
                                        />
                                    )}
                                    <div>
                                        <p className="report-product-name">{rpt.product_name}</p>
                                        <p className="report-seller-name">Seller: {rpt.seller_name}</p>
                                    </div>
                                </div>
                                <StatusPill status={rpt.status} />
                            </div>

                            {/* Body */}
                            <div className="report-card-body">
                                <div className="report-meta-row">
                                    <span className="report-reason-tag">{reasonLabel[rpt.reason] || rpt.reason}</span>
                                    <span className="report-date">{new Date(rpt.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                                </div>
                                <div className="report-reporter">
                                    <strong>Reported by:</strong> {rpt.reporter_name} ({rpt.reporter_email})
                                </div>
                                {rpt.description && (
                                    <p className="report-description">"{rpt.description}"</p>
                                )}
                                {rpt.admin_note && (
                                    <p className="report-admin-note">📝 Admin note: {rpt.admin_note}</p>
                                )}
                            </div>

                            {/* Actions — only for pending/reviewed */}
                            {(rpt.status === 'pending' || rpt.status === 'reviewed') && (
                                <div className="report-card-actions">
                                    <textarea
                                        className="report-note-input"
                                        placeholder="Add admin note (optional)…"
                                        rows={2}
                                        value={noteInput[rpt.id] || ''}
                                        onChange={e => setNoteInput(p => ({ ...p, [rpt.id]: e.target.value }))}
                                        onClick={e => e.stopPropagation()}
                                    />
                                    <div className="report-action-btns">
                                        <button type="button" className="admin-mini-btn approve"
                                            onClick={() => runAction(
                                                () => adminRequest(`/api/admin/reports/${rpt.id}/resolve`, {
                                                    method: 'PATCH',
                                                    body: JSON.stringify({ status: 'reviewed', adminNote: noteInput[rpt.id] || null }),
                                                }),
                                                'Report marked as reviewed.'
                                            )}>
                                            Mark Reviewed
                                        </button>
                                        <button type="button" className="admin-mini-btn"
                                            style={{ color: '#dc2626', borderColor: '#dc2626' }}
                                            onClick={() => runAction(
                                                () => adminRequest(`/api/admin/reports/${rpt.id}/resolve`, {
                                                    method: 'PATCH',
                                                    body: JSON.stringify({ status: 'resolved', adminNote: noteInput[rpt.id] || null }),
                                                }),
                                                'Report resolved — product blocked.'
                                            )}>
                                            Resolve & Block Product
                                        </button>
                                        <button type="button" className="admin-mini-btn"
                                            style={{ color: '#64748b' }}
                                            onClick={() => runAction(
                                                () => adminRequest(`/api/admin/reports/${rpt.id}/resolve`, {
                                                    method: 'PATCH',
                                                    body: JSON.stringify({ status: 'dismissed', adminNote: noteInput[rpt.id] || null }),
                                                }),
                                                'Report dismissed.'
                                            )}>
                                            Dismiss
                                        </button>
                                    </div>
                                </div>
                            )}
                        </article>
                    ))}
                </div>
            )}
        </div>
    );
}

// ─── Expired Products Section ──────────────────────────────────────────────
function ExpiredProductsTab({ adminRequest, authoritativeExpiredCount, setAuthoritativeExpiredCount, refreshAdminData }) {
    const [products, setProducts]   = useState([]);
    const [meta, setMeta]           = useState({ total: 0, page: 1, limit: 20, totalPages: 1 });
    const [loading, setLoading]     = useState(false);
    const [deleting, setDeleting]   = useState(false);
    const [query, setQuery]         = useState('');
    const [debouncedQuery, setDebouncedQuery] = useState('');
    const [page, setPage]           = useState(1);
    const [selectedIds, setSelectedIds] = useState(new Set());
    const [message, setMessage]     = useState('');
    const [error, setError]         = useState('');
    const [viewMode, setViewMode]   = useState('cards');
    const [modal, setModal]         = useState({ open: false, type: null, singleId: null, singleName: '' });

    // Debounce search query
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedQuery(query);
            setPage(1);
        }, 300);
        return () => clearTimeout(timer);
    }, [query]);

    // Keyboard Escape listener to dismiss modal
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape' && modal.open && !deleting) {
                setModal({ open: false, type: null, singleId: null, singleName: '' });
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [modal.open, deleting]);

    const loadExpired = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const q = debouncedQuery ? `&q=${encodeURIComponent(debouncedQuery)}` : '';
            const res = await adminRequest(`/api/admin/products/expired?page=${page}&limit=20${q}`);
            setProducts(res.data || []);
            setMeta(res.meta || { total: 0, page: 1, limit: 20, totalPages: 1 });
            if (res.meta?.authoritativeTotal !== undefined) {
                setAuthoritativeExpiredCount(res.meta.authoritativeTotal);
            }
        } catch (err) {
            setError(err.message || 'Failed to load expired products');
        } finally {
            setLoading(false);
        }
    }, [adminRequest, debouncedQuery, page, setAuthoritativeExpiredCount]);

    useEffect(() => {
        loadExpired();
    }, [loadExpired]);

    // Selection logic
    const allOnPageSelected = products.length > 0 && products.every(p => selectedIds.has(p.id));
    const someOnPageSelected = products.some(p => selectedIds.has(p.id));

    const toggleSelectAllPage = () => {
        const next = new Set(selectedIds);
        if (allOnPageSelected) {
            products.forEach(p => next.delete(p.id));
        } else {
            products.forEach(p => next.add(p.id));
        }
        setSelectedIds(next);
    };

    const toggleSelectProduct = (id) => {
        const next = new Set(selectedIds);
        if (next.has(id)) {
            next.delete(id);
        } else {
            next.add(id);
        }
        setSelectedIds(next);
    };

    const deselectAll = () => {
        setSelectedIds(new Set());
    };

    // Deletion executions
    const handleDeleteSelected = async () => {
        if (selectedIds.size === 0) return;
        setDeleting(true);
        setError('');
        setMessage('');
        try {
            const res = await adminRequest('/api/admin/products/expired/selected', {
                method: 'DELETE',
                body: JSON.stringify({ productIds: Array.from(selectedIds) })
            });
            const deleted = res.data?.deletedCount ?? selectedIds.size;
            setMessage(`${deleted} expired product(s) deleted successfully.`);
            setSelectedIds(new Set());
            setModal({ open: false, type: null, singleId: null, singleName: '' });
            await loadExpired();
            if (refreshAdminData) refreshAdminData();
        } catch (err) {
            setError(err.message || 'Failed to delete selected expired products');
        } finally {
            setDeleting(false);
        }
    };

    const handleDeleteAll = async () => {
        setDeleting(true);
        setError('');
        setMessage('');
        try {
            const res = await adminRequest('/api/admin/products/expired', {
                method: 'DELETE'
            });
            const deleted = res.data?.deletedCount ?? authoritativeExpiredCount;
            setMessage(`${deleted} expired product(s) deleted successfully.`);
            setSelectedIds(new Set());
            setModal({ open: false, type: null, singleId: null, singleName: '' });
            await loadExpired();
            if (refreshAdminData) refreshAdminData();
        } catch (err) {
            setError(err.message || 'Failed to delete all expired products');
        } finally {
            setDeleting(false);
        }
    };

    const handleDeleteSingle = async () => {
        if (!modal.singleId) return;
        setDeleting(true);
        setError('');
        setMessage('');
        try {
            await adminRequest(`/api/admin/products/expired/${modal.singleId}`, {
                method: 'DELETE'
            });
            setMessage(`Expired product "${modal.singleName}" deleted successfully.`);
            const next = new Set(selectedIds);
            next.delete(modal.singleId);
            setSelectedIds(next);
            setModal({ open: false, type: null, singleId: null, singleName: '' });
            await loadExpired();
            if (refreshAdminData) refreshAdminData();
        } catch (err) {
            setError(err.message || 'Failed to delete expired product');
        } finally {
            setDeleting(false);
        }
    };

    const formatDate = (dateStr) => {
        if (!dateStr) return 'N/A';
        try {
            const d = new Date(dateStr);
            return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
        } catch {
            return String(dateStr);
        }
    };

    const getDaysExpired = (dateStr) => {
        if (!dateStr) return null;
        try {
            const exp = new Date(dateStr);
            const now = new Date();
            const diffTime = now.setHours(0,0,0,0) - exp.setHours(0,0,0,0);
            const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
            if (diffDays <= 0) return 'Expires today';
            if (diffDays === 1) return 'Expired yesterday';
            return `Expired ${diffDays} days ago`;
        } catch {
            return null;
        }
    };

    return (
        <div className="expired-products-section">
            {/* Authoritative Count Banner */}
            <div className={`expired-count-banner ${authoritativeExpiredCount > 0 ? 'warning' : 'clean'}`}>
                <div className="expired-banner-icon">
                    {authoritativeExpiredCount > 0 ? <FaExclamationTriangle /> : <FaCheckCircle />}
                </div>
                <div className="expired-banner-text">
                    <h3>
                        {authoritativeExpiredCount > 0
                            ? `⚠ ${authoritativeExpiredCount} product${authoritativeExpiredCount === 1 ? '' : 's'} currently expired`
                            : 'No expired products currently'}
                    </h3>
                    <p>
                        {authoritativeExpiredCount > 0
                            ? 'The products listed below have passed their expiration date. Remove them to prevent consumers from seeing expired listings.'
                            : 'All product inventory in the marketplace is within valid, unexpired dates.'}
                    </p>
                </div>
            </div>

            {(message || error) && (
                <p className={`admin-alert ${error ? 'error' : 'success'}`}>
                    {error || message}
                </p>
            )}

            {/* Toolbar */}
            <div className="expired-toolbar">
                <div className="expired-search-wrap">
                    <FaSearch />
                    <input
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                        placeholder="Search expired products by name, ID, seller, category…"
                        aria-label="Search expired products"
                    />
                </div>
                <div className="expired-actions-group">
                    {/* View Switcher: Cards vs Table */}
                    <div className="admin-view-toggle" role="group" aria-label="Display view mode">
                        <button
                            type="button"
                            className={`admin-view-btn ${viewMode === 'cards' ? 'active' : ''}`}
                            onClick={() => setViewMode('cards')}
                            title="Cards view"
                            aria-label="Switch to Cards view"
                        >
                            <FaThLarge /> Cards
                        </button>
                        <button
                            type="button"
                            className={`admin-view-btn ${viewMode === 'table' ? 'active' : ''}`}
                            onClick={() => setViewMode('table')}
                            title="Table view"
                            aria-label="Switch to Table view"
                        >
                            <FaThList /> Table
                        </button>
                    </div>

                    <div className="selection-counter" aria-live="polite">
                        Selected: <strong>{selectedIds.size}</strong>
                    </div>
                    {products.length > 0 && (
                        <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={toggleSelectAllPage}
                        >
                            {allOnPageSelected ? 'Deselect Page' : 'Select Page'}
                        </button>
                    )}
                    {selectedIds.size > 0 && (
                        <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={deselectAll}
                        >
                            Deselect All
                        </button>
                    )}
                    <button
                        type="button"
                        className="btn btn-danger btn-sm"
                        disabled={selectedIds.size === 0 || deleting}
                        onClick={() => setModal({ open: true, type: 'selected' })}
                    >
                        <FaTrash /> Delete Selected ({selectedIds.size})
                    </button>
                    <button
                        type="button"
                        className="btn btn-danger btn-sm"
                        disabled={authoritativeExpiredCount === 0 || deleting}
                        onClick={() => setModal({ open: true, type: 'all' })}
                    >
                        <FaTrash /> Delete All Expired ({authoritativeExpiredCount})
                    </button>
                </div>
            </div>

            {loading && <div className="admin-loading">Loading expired products…</div>}

            {!loading && products.length === 0 && (
                <div className="admin-empty">
                    {debouncedQuery ? 'No expired products match your search.' : 'No expired products found.'}
                </div>
            )}

            {/* Product Cards View */}
            {!loading && products.length > 0 && viewMode === 'cards' && (
                <div className="admin-expired-cards-grid">
                    {products.map(item => {
                        const isSelected = selectedIds.has(item.id);
                        const normalized = normalizeProduct({
                            ...item,
                            selling_price: item.selling_price || item.price,
                            price: item.selling_price || item.price,
                            mrp: item.mrp || item.originalPrice,
                            image_url: item.image_url,
                            image: item.image_url,
                            expiry_date: item.expiry_date,
                            expiry: item.expiry_date,
                            expiryStatus: 'Expired',
                            isExpired: true,
                            location: item.seller_name ? `Available from ${item.seller_name}` : 'Available from Bylot seller'
                        });

                        return (
                            <div key={item.id} className={`admin-expired-card-item ${isSelected ? 'is-selected' : ''}`}>
                                <div className="admin-card-select-bar">
                                    <label className="admin-card-select-label">
                                        <input
                                            type="checkbox"
                                            checked={isSelected}
                                            onChange={() => toggleSelectProduct(item.id)}
                                            aria-label={`Select ${item.name}`}
                                        />
                                        <span>{isSelected ? 'Selected' : 'Select'}</span>
                                    </label>
                                    <span className="admin-product-id" style={{ fontSize: '0.74rem' }}>
                                        {item.product_item_id || `#${item.id}`}
                                    </span>
                                </div>
                                <ProductCard
                                    product={normalized}
                                    isAdmin={true}
                                    onAdminDelete={(id, name) => setModal({
                                        open: true,
                                        type: 'single',
                                        singleId: id,
                                        singleName: name || item.name
                                    })}
                                />
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Product Table View */}
            {!loading && products.length > 0 && viewMode === 'table' && (
                <div className="admin-table-wrap">
                    <table className="admin-table">
                        <thead>
                            <tr>
                                <th style={{ width: '40px' }}>
                                    <input
                                        type="checkbox"
                                        checked={allOnPageSelected}
                                        ref={el => { if (el) el.indeterminate = someOnPageSelected && !allOnPageSelected; }}
                                        onChange={toggleSelectAllPage}
                                        aria-label="Select all on current page"
                                    />
                                </th>
                                <th>Product</th>
                                <th>Seller</th>
                                <th>Category</th>
                                <th>Expiry Date</th>
                                <th>Status</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {products.map(item => {
                                const isSelected = selectedIds.has(item.id);
                                const expInfo = formatCardExpiry(item);
                                const imgSrc = item.image_url
                                    ? (item.image_url.startsWith('http') ? item.image_url : `${API_BASE_URL}/${String(item.image_url).replace(/^\/+/, '')}`)
                                    : null;
                                return (
                                    <tr key={item.id} className={isSelected ? 'row-selected' : ''}>
                                        <td>
                                            <input
                                                type="checkbox"
                                                checked={isSelected}
                                                onChange={() => toggleSelectProduct(item.id)}
                                                aria-label={`Select ${item.name}`}
                                            />
                                        </td>
                                        <td>
                                            <div className="product-table-cell">
                                                {imgSrc && (
                                                    <img
                                                        src={imgSrc}
                                                        alt={item.name}
                                                        className="admin-product-thumb"
                                                        onError={e => { e.target.style.display = 'none'; }}
                                                    />
                                                )}
                                                <div>
                                                    <div><strong>{item.name}</strong></div>
                                                    <div>
                                                        <span className="admin-product-id">
                                                            {item.product_item_id || `#${item.id}`}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                        <td>{item.seller_name || 'N/A'}</td>
                                        <td>{item.category_name || 'N/A'}</td>
                                        <td>
                                            <div>
                                                <strong>{expInfo?.formattedDate || item.expiry_date}</strong>
                                                {expInfo?.relativeLabel && <div className="expired-relative-tag">{expInfo.relativeLabel}</div>}
                                            </div>
                                        </td>
                                        <td><StatusPill status={item.status} /></td>
                                        <td>
                                            <div className="admin-action-row">
                                                <button
                                                    type="button"
                                                    className="admin-icon-btn danger"
                                                    title={`Delete ${item.name}`}
                                                    aria-label={`Delete ${item.name}`}
                                                    disabled={deleting}
                                                    onClick={() => setModal({
                                                        open: true,
                                                        type: 'single',
                                                        singleId: item.id,
                                                        singleName: item.name
                                                    })}
                                                >
                                                    <FaTrash />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Pagination */}
            {!loading && meta.totalPages > 1 && (
                <div className="admin-pagination">
                    <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        disabled={page <= 1 || loading}
                        onClick={() => setPage(p => Math.max(1, p - 1))}
                        aria-label="Previous page"
                    >
                        <FaChevronLeft /> Previous
                    </button>
                    <span className="pagination-info">
                        Page <strong>{page}</strong> of <strong>{meta.totalPages}</strong> ({meta.total} items)
                    </span>
                    <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        disabled={page >= meta.totalPages || loading}
                        onClick={() => setPage(p => Math.min(meta.totalPages, p + 1))}
                        aria-label="Next page"
                    >
                        Next <FaChevronRight />
                    </button>
                </div>
            )}

            {/* Confirmation Modal */}
            {modal.open && (
                <div
                    className="admin-modal-backdrop"
                    onClick={() => !deleting && setModal({ open: false, type: null, singleId: null, singleName: '' })}
                    role="presentation"
                >
                    <div
                        className="admin-modal"
                        onClick={e => e.stopPropagation()}
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="expired-modal-title"
                    >
                        <div className="admin-modal-header">
                            <div className="admin-modal-icon danger">
                                <FaExclamationTriangle />
                            </div>
                            <h3 id="expired-modal-title">
                                {modal.type === 'all' && 'Delete All Expired Products?'}
                                {modal.type === 'selected' && 'Delete Selected Expired Products?'}
                                {modal.type === 'single' && 'Delete Expired Product?'}
                            </h3>
                        </div>
                        <div className="admin-modal-body">
                            {modal.type === 'all' && (
                                <p>
                                    There are currently <strong>{authoritativeExpiredCount}</strong> expired product(s) in the marketplace.
                                    ALL currently expired products will be permanently removed from active listings.
                                    <br /><br />
                                    <span className="admin-modal-warning">⚠ This action cannot be undone.</span>
                                </p>
                            )}
                            {modal.type === 'selected' && (
                                <p>
                                    You selected <strong>{selectedIds.size}</strong> expired product(s).
                                    These products will be permanently removed from active listings.
                                    <br /><br />
                                    <span className="admin-modal-warning">⚠ This action cannot be undone.</span>
                                </p>
                            )}
                            {modal.type === 'single' && (
                                <p>
                                    Are you sure you want to permanently delete <strong>{modal.singleName}</strong>?
                                    This product will be removed from active marketplace listings.
                                    <br /><br />
                                    <span className="admin-modal-warning">⚠ This action cannot be undone.</span>
                                </p>
                            )}
                        </div>
                        <div className="admin-modal-footer">
                            <button
                                type="button"
                                className="btn btn-secondary"
                                onClick={() => setModal({ open: false, type: null, singleId: null, singleName: '' })}
                                disabled={deleting}
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                className="btn btn-danger"
                                disabled={deleting}
                                onClick={() => {
                                    if (modal.type === 'all') handleDeleteAll();
                                    else if (modal.type === 'selected') handleDeleteSelected();
                                    else if (modal.type === 'single') handleDeleteSingle();
                                }}
                            >
                                {deleting ? 'Deleting…' : (
                                    modal.type === 'all' ? 'Delete All Expired' :
                                    modal.type === 'selected' ? `Delete Selected (${selectedIds.size})` :
                                    'Delete Product'
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// ─── Shared helpers ────────────────────────────────────────────────────────
function AdminSearch({ activeTab, query, setQuery }) {
    const placeholder = activeTab === 'products'
        ? 'Search products by name or ID…'
        : `Search ${activeTab}…`;
    return (
        <div className="admin-toolbar">
            <FaSearch />
            <input value={query} onChange={e => setQuery(e.target.value)} placeholder={placeholder} />
        </div>
    );
}

function AdminTable({ columns, rows, emptyText }) {
    if (!rows.length) return <div className="admin-empty">{emptyText}</div>;
    return (
        <div className="admin-table-wrap">
            <table className="admin-table">
                <thead><tr>{columns.map(c => <th key={c}>{c}</th>)}</tr></thead>
                <tbody>{rows.map((row, ri) => <tr key={ri}>{row.map((cell, ci) => <td key={ci}>{cell}</td>)}</tr>)}</tbody>
            </table>
        </div>
    );
}

function StatusPill({ status }) {
    return <span className={`admin-status ${String(status || 'unknown').toLowerCase()}`}>{status || 'unknown'}</span>;
}

export default AdminPanel;
