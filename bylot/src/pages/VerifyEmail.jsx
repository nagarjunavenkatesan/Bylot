import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import SEOHead from '../components/SEOHead';
import { pageSEO } from '../utils/seo';
import { apiRequest } from '../api/backendApi';

const verifySEO = pageSEO({
    title: 'Verify Email',
    description: 'Verify your Bylot account email address.',
    path: '/verify-email',
    noindex: true,
});

export default function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';

  const [loading, setLoading] = useState(() => Boolean(token));
  const [error, setError] = useState(() => (!token ? 'Verification token is missing from the link.' : ''));
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!token) return;

    let isMounted = true;
    apiRequest(`/api/auth/verify-email?token=${encodeURIComponent(token)}`)
      .then(() => {
        if (isMounted) {
          setSuccess(true);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          setError(err.message || 'Email verification failed or link has expired.');
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [token]);

  return (
    <div style={{ maxWidth: 440, margin: '60px auto', padding: '30px', background: 'var(--card-bg, #fff)', borderRadius: '12px', boxShadow: '0 4px 20px rgba(0,0,0,0.08)', textAlign: 'center' }}>
      <SEOHead {...verifySEO} />
      <h2 style={{ marginBottom: 16, fontSize: '1.6rem' }}>Account Email Verification</h2>

      {loading && (
        <div style={{ color: '#666', padding: '20px 0' }}>
          Verifying your email address, please wait...
        </div>
      )}

      {error && (
        <div style={{ padding: '16px', background: '#ffebee', color: '#c62828', borderRadius: 8, marginBottom: 20, fontSize: '0.95rem' }}>
          <p style={{ margin: 0, fontWeight: 500 }}>{error}</p>
          <div style={{ marginTop: 16 }}>
            <Link to="/login" style={{ color: '#c62828', fontWeight: 600 }}>Go to Login</Link>
          </div>
        </div>
      )}

      {success && (
        <div style={{ padding: '16px', background: '#e8f5e9', color: '#2e7d32', borderRadius: 8, marginBottom: 20, fontSize: '0.95rem' }}>
          <p style={{ margin: 0, fontWeight: 600 }}>Your email address has been successfully verified!</p>
          <p style={{ marginTop: 8, color: '#444' }}>You can now sign in to your Bylot account.</p>
          <div style={{ marginTop: 16 }}>
            <Link to="/login" style={{ display: 'inline-block', padding: '10px 24px', background: '#2e7d32', color: '#fff', borderRadius: 8, textDecoration: 'none', fontWeight: 600 }}>
              Sign In Now
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
