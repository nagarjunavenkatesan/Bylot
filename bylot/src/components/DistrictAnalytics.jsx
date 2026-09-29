import React, { useMemo } from 'react';

function formatCurrency(value) {
    return `Rs ${Number(value || 0).toLocaleString('en-IN')}`;
}

function DistrictBarChart({ title, rows = [], valueKey, countKey, color }) {
    const values = rows.map((row) => Number(row[valueKey]) || 0);
    const maxValue = values.length > 0 ? Math.max(...values, 1) : 1;

    return (
        <article className="admin-chart-card">
            <div className="admin-chart-head">
                <h3>{title}</h3>
                <span>{rows.reduce((sum, row) => sum + (Number(row[countKey]) || 0), 0)} total</span>
            </div>
            <div className="admin-chart-body">
                {rows.length === 0 ? (
                    <p className="admin-chart-empty">No district data yet.</p>
                ) : (
                    rows.map((row, idx) => (
                        <div className="admin-chart-row" key={`${title}-${row.district || idx}`}>
                            <div className="admin-chart-meta">
                                <strong>{row.district || 'Unknown District'}</strong>
                                <span>{row[countKey] || 0} listings · {formatCurrency(row[valueKey])}</span>
                            </div>
                            <div className="admin-chart-track">
                                <div
                                    className="admin-chart-bar"
                                    style={{
                                        width: `${Math.max(((Number(row[valueKey]) || 0) / maxValue) * 100, row[countKey] ? 8 : 0)}%`,
                                        background: color,
                                    }}
                                />
                            </div>
                        </div>
                    ))
                )}
            </div>
        </article>
    );
}

const DistrictAnalytics = ({ rows = [], totals = null, loading = false }) => {
    const safeRows = Array.isArray(rows) ? rows : [];
    const sellRows = useMemo(
        () => [...safeRows].sort((a, b) => (Number(b?.sellCount) || 0) - (Number(a?.sellCount) || 0) || String(a?.district || '').localeCompare(String(b?.district || ''))),
        [safeRows]
    );
    const buyRows = useMemo(
        () => [...safeRows].sort((a, b) => (Number(b?.buyCount) || 0) - (Number(a?.buyCount) || 0) || String(a?.district || '').localeCompare(String(b?.district || ''))),
        [safeRows]
    );

    if (loading) {
        return <p className="admin-loading">Loading district analytics...</p>;
    }

    return (
        <section className="admin-district-section">
            <div className="admin-district-summary">
                <article className="admin-stat">
                    <span>Total sells</span>
                    <strong>{totals?.sellCount || 0}</strong>
                    <small>{formatCurrency(totals?.sellValue)}</small>
                </article>
                <article className="admin-stat">
                    <span>Total buys</span>
                    <strong>{totals?.buyCount || 0}</strong>
                    <small>{formatCurrency(totals?.buyValue)}</small>
                </article>
                <article className="admin-stat">
                    <span>Districts covered</span>
                    <strong>{rows.length}</strong>
                    <small>Sell & buy activity</small>
                </article>
            </div>

            <div className="admin-chart-grid">
                <DistrictBarChart
                    title="District-wise sells"
                    rows={sellRows}
                    valueKey="sellValue"
                    countKey="sellCount"
                    color="linear-gradient(90deg, #6366f1, #8b5cf6)"
                />
                <DistrictBarChart
                    title="District-wise buys"
                    rows={buyRows}
                    valueKey="buyValue"
                    countKey="buyCount"
                    color="linear-gradient(90deg, #10b981, #14b8a6)"
                />
            </div>

            <div className="admin-table-wrap">
                <table className="admin-table admin-district-table">
                    <thead>
                        <tr>
                            <th>District</th>
                            <th>Sell listings</th>
                            <th>Sell value</th>
                            <th>Buy orders</th>
                            <th>Buy value</th>
                            <th>Total activity</th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.length === 0 ? (
                            <tr>
                                <td colSpan={6} className="admin-chart-empty">No district activity recorded yet.</td>
                            </tr>
                        ) : (
                            rows.map((row) => (
                                <tr key={row.district}>
                                    <td>{row.district}</td>
                                    <td>{row.sellCount}</td>
                                    <td>{formatCurrency(row.sellValue)}</td>
                                    <td>{row.buyCount}</td>
                                    <td>{formatCurrency(row.buyValue)}</td>
                                    <td>{row.sellCount + row.buyCount}</td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </section>
    );
};

export default DistrictAnalytics;
