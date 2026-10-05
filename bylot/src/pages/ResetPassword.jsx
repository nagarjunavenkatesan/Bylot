import React, { useState } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import SEOHead from '../components/SEOHead';
import { pageSEO } from '../utils/seo';
import { apiRequest } from '../api/backendApi';

const resetSEO = pageSEO({
    title: 'Reset Password',
    description: 'Reset your Bylot account password.',
    path: '/reset-password',
    noindex: true,
});

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const navigate = useNavigate();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [status, setStatus] = useState({ loading: false, error: '', success: '' });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!token) {
      setStatus({ loading: false, error: 'Reset token is missing from the URL.', success: '' });
      return;
    }
    if (password.length < 10) {
      setStatus({ loading: false, error: 'Password must be at least 10 characters long.', success: '' });
      return;
    }
    if (password !== confirmPassword) {
      setStatus({ loading: false, error: 'Passwords do not match.', success: '' });
      return;
    }

    setStatus({ loading: true, error: '', success: '' });
    try {
      await apiRequest('/api/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ token, password })
      });
      setStatus({
        loading: false,
        error: '',
        success: 'Your password has been successfully reset! You can now log in.'
      });
      setTimeout(() => navigate('/login'), 3000);
    } catch (err) {
      setStatus({ loading: false, error: err.message || 'Failed to reset password.', success: '' });
    }
  };

  return (
    <div style={{ maxWidth: 440, margin: '60px auto', padding: '30px', background: 'var(--card-bg, #fff)', borderRadius: '12px', boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }}>
      <SEOHead {...resetSEO} />
      <h2 style={{ marginBottom: 8, fontSize: '1.6rem' }}>Reset Your Password</h2>
      <p style={{ color: '#666', marginBottom: 24, fontSize: '0.95rem' }}>
        Enter a strong, secure new password for your account.
      </p>

      {status.error && (
        <div style={{ padding: '12px', background: '#ffebee', color: '#c62828', borderRadius: 8, marginBottom: 16, fontSize: '0.9rem' }}>
          {status.error}
        </div>
      )}

      {status.success && (
        <div style={{ padding: '12px', background: '#e8f5e9', color: '#2e7d32', borderRadius: 8, marginBottom: 16, fontSize: '0.9rem' }}>
          {status.success}
          <div style={{ marginTop: 8 }}>
            <Link to="/login" style={{ color: '#1b5e20', fontWeight: 'bold' }}>Click here to log in</Link>
          </div>
        </div>
      )}

      {!status.success && (
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', marginBottom: 6, fontWeight: 500, fontSize: '0.9rem' }}>
              New Password (min 10 characters)
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={10}
              placeholder="Enter new password"
              style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid #ccc', fontSize: '1rem', boxSizing: 'border-box' }}
            />
          </div>

          <div style={{ marginBottom: 24 }}>
            <label style={{ display: 'block', marginBottom: 6, fontWeight: 500, fontSize: '0.9rem' }}>
              Confirm New Password
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={10}
              placeholder="Confirm new password"
              style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid #ccc', fontSize: '1rem', boxSizing: 'border-box' }}
            />
          </div>

          <button
            type="submit"
            disabled={status.loading}
            style={{
              width: '100%',
              padding: '12px',
              background: '#2563eb',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              fontSize: '1rem',
              fontWeight: 600,
              cursor: status.loading ? 'not-allowed' : 'pointer'
            }}
          >
            {status.loading ? 'Resetting Password...' : 'Reset Password'}
          </button>
        </form>
      )}

      <div style={{ marginTop: 24, textAlign: 'center' }}>
        <Link to="/login" style={{ color: '#2563eb', fontSize: '0.9rem', textDecoration: 'none' }}>
          Back to Login
        </Link>
      </div>
    </div>
  );
}
