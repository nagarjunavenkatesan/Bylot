import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import PageTransition from '../components/PageTransition';
import { useAuth } from '../context/AuthContext';
import { apiRequest } from '../api/backendApi';
import { moneyFormatter } from '../utils/pricing';
import '../styles/SellerOrders.css';

const NEXT_ACTIONS = {
  pending: [
    { status: 'confirmed', label: 'Confirm', variant: 'primary' },
    { status: 'rejected', label: 'Reject', variant: 'danger' },
  ],
  confirmed: [
    { status: 'ready', label: 'Mark ready', variant: 'primary' },
    { status: 'rejected', label: 'Reject', variant: 'danger' },
  ],
  packed: [
    { status: 'shipped', label: 'Shipped', variant: 'primary' },
    { status: 'rejected', label: 'Cancel', variant: 'danger' },
  ],
  shipped: [{ status: 'completed', label: 'Complete', variant: 'primary' }],
};

function statusLabel(status) {
  const map = {
    pending: 'Pending',
    confirmed: 'Confirmed',
    packed: 'Ready for pickup',
    shipped: 'Shipped',
    delivered: 'Completed',
    cancelled: 'Rejected / cancelled',
  };
  return map[status] || status;
}

const SellerOrders = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({ totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [sellerApproved, setSellerApproved] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [updatingId, setUpdatingId] = useState(null);

  const loadSeller = useCallback(async () => {
    try {
      const res = await apiRequest('/api/sellers/profile');
      const seller = res?.data;
      if (seller?.approval_status === 'approved') {
        setSellerApproved(true);
        return true;
      }
      setSellerApproved(false);
      return false;
    } catch {
      setSellerApproved(false);
      return false;
    }
  }, []);

  const loadOrders = useCallback(async (pageNum = 1) => {
    setLoading(true);
    setMessage({ type: '', text: '' });
    try {
      const res = await apiRequest(`/api/sellers/orders?page=${pageNum}&limit=10`);
      setOrders(Array.isArray(res?.data) ? res.data : []);
      setMeta(res?.meta || { totalPages: 1 });
      setPage(pageNum);
    } catch (err) {
      setMessage({ type: 'error', text: err.message || 'Failed to load orders' });
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!user) {
      navigate('/login', { state: { from: '/seller/orders' } });
      return;
    }
    (async () => {
      const ok = await loadSeller();
      if (ok || user.role === 'admin') {
        await loadOrders(1);
      } else {
        setLoading(false);
      }
    })();
  }, [user, navigate, loadSeller, loadOrders]);

  const updateStatus = async (orderId, status) => {
    setUpdatingId(orderId);
    setMessage({ type: '', text: '' });
    try {
      await apiRequest(`/api/sellers/orders/${orderId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      setMessage({ type: 'success', text: 'Order updated successfully' });
      await loadOrders(page);
    } catch (err) {
      setMessage({ type: 'error', text: err.message || 'Could not update order' });
    } finally {
      setUpdatingId(null);
    }
  };

  if (!user) return null;

  if (!sellerApproved && user.role !== 'admin') {
    return (
      <PageTransition>
        <div className="container seller-orders-page">
          <h1>Seller orders</h1>
          <p className="seller-orders-muted">
            Your seller account must be approved before you can manage orders.{' '}
            <Link to="/sell">Complete seller setup</Link>
          </p>
        </div>
      </PageTransition>
    );
  }

  return (
    <PageTransition>
      <div className="container seller-orders-page">
        <header className="seller-orders-header">
          <h1>Seller orders</h1>
          <Link to="/sell" className="btn btn-secondary btn-sm">
            Back to dashboard
          </Link>
        </header>

        {message.text && (
          <div className={`seller-orders-alert seller-orders-alert--${message.type}`} role="status">
            {message.text}
          </div>
        )}

        {loading ? (
          <p>Loading orders…</p>
        ) : orders.length === 0 ? (
          <p className="seller-orders-muted">No orders yet.</p>
        ) : (
          <ul className="seller-orders-list">
            {orders.map((order) => (
              <li key={order.id} className="seller-order-card">
                <div className="seller-order-card__head">
                  <div>
                    <strong>Order #{order.order_number || order.id}</strong>
                    <span className={`seller-order-status seller-order-status--${order.status}`}>
                      {statusLabel(order.status)}
                    </span>
                  </div>
                  <time dateTime={order.created_at}>
                    {order.created_at ? new Date(order.created_at).toLocaleString('en-IN') : ''}
                  </time>
                </div>
                <p>
                  <strong>Customer:</strong> {order.customer_name || '—'}
                  {order.customer_phone ? ` · ${order.customer_phone}` : ''}
                </p>
                {order.pickup_address || order.delivery_address ? (
                  <p>
                    <strong>Pickup / delivery:</strong>{' '}
                    {order.pickup_address || order.delivery_address}
                  </p>
                ) : null}
                {order.notes ? (
                  <p>
                    <strong>Notes:</strong> {order.notes}
                  </p>
                ) : null}
                <p className="seller-order-total">
                  Total: {moneyFormatter.format(Number(order.grand_total || order.total_amount || 0))}
                </p>
                {Array.isArray(order.items) && order.items.length > 0 && (
                  <ul className="seller-order-items">
                    {order.items.map((item) => (
                      <li key={`${order.id}-${item.id || item.product_id}`}>
                        {item.product_name || item.name || `Product #${item.product_id}`} × {item.quantity}
                        {' — '}
                        {moneyFormatter.format(Number(item.total || item.unit_price * item.quantity || 0))}
                      </li>
                    ))}
                  </ul>
                )}
                <div className="seller-order-actions">
                  {(NEXT_ACTIONS[order.status] || []).map((action) => (
                    <button
                      key={action.status}
                      type="button"
                      className={`btn ${action.variant === 'danger' ? 'btn-danger' : 'btn-primary'} seller-order-action-btn`}
                      disabled={updatingId === order.id}
                      onClick={() => updateStatus(order.id, action.status)}
                    >
                      {updatingId === order.id ? 'Updating…' : action.label}
                    </button>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        )}

        {meta.totalPages > 1 && (
          <nav className="seller-orders-pagination" aria-label="Orders pagination">
            <button
              type="button"
              className="btn btn-secondary"
              disabled={page <= 1 || loading}
              onClick={() => loadOrders(page - 1)}
            >
              Previous
            </button>
            <span>
              Page {page} of {meta.totalPages}
            </span>
            <button
              type="button"
              className="btn btn-secondary"
              disabled={page >= meta.totalPages || loading}
              onClick={() => loadOrders(page + 1)}
            >
              Next
            </button>
          </nav>
        )}
      </div>
    </PageTransition>
  );
};

export default SellerOrders;
