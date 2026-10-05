import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { FaEye, FaEyeSlash } from 'react-icons/fa';
import { GoogleLogin } from '@react-oauth/google';
import PageTransition from '../components/PageTransition';
import SEOHead from '../components/SEOHead';
import { pageSEO } from '../utils/seo';
import { useAuth } from '../context/AuthContext';

const loginSEO = pageSEO({
    title: 'Sign In',
    description: 'Sign in to your Bylot account to access your deals and listings.',
    path: '/login',
    noindex: true,
});

import { apiRequest } from '../api/backendApi';
import { useGoogleAuth } from '../components/GoogleProvider';

function getRedirectPath(role) {
    switch (role) {
        case 'admin': return '/admin';
        case 'seller': return '/sell';
        default: return '/';
    }
}

const Login = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { login, user } = useAuth();
    const { isConfigured: isGoogleConfigured } = useGoogleAuth();

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [resendMsg, setResendMsg] = useState('');
    const [resendLoading, setResendLoading] = useState(false);

    useEffect(() => {
        if (user) {
            const redirect = location.state?.from || getRedirectPath(user.role);
            navigate(redirect, { replace: true });
        }
    }, [user, navigate, location.state]);

    const handleEmailLogin = async (e) => {
        e.preventDefault();
        if (!email || !password) {
            setError('Please enter both email and password.');
            return;
        }

        setLoading(true);
        setError('');
        try {
            const data = await apiRequest('/api/auth/login', {
                method: 'POST',
                body: JSON.stringify({ email, password }),
            });
            const userData = data.data?.user || data.user;
            const accessToken = data.data?.accessToken || data.accessToken || data.user?.token;
            login({ ...userData, accessToken });
            const redirect = location.state?.from || getRedirectPath(userData.role);
            navigate(redirect, { replace: true });
        } catch (err) {
            setError(err.message || 'Login failed. Please check your credentials.');
        } finally {
            setLoading(false);
        }
    };

    const handleGoogleSuccess = async (credentialResponse) => {
        setLoading(true);
        setError('');
        try {
            const data = await apiRequest('/api/auth/google-login', {
                method: 'POST',
                body: JSON.stringify({ idToken: credentialResponse.credential }),
            });
            const userData = data.data?.user || data.user;
            const accessToken = data.data?.accessToken || data.accessToken || data.user?.token;
            login({ ...userData, accessToken });
            const redirect = location.state?.from || getRedirectPath(userData.role);
            navigate(redirect, { replace: true });
        } catch (err) {
            setError(err.message || 'Google sign-in failed. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleGoogleError = () => {
        setError('Google sign-in was cancelled or encountered an error.');
    };

    const handleResendVerification = async () => {
        if (!email.trim()) {
            setResendMsg('Enter your email above first.');
            return;
        }
        setResendLoading(true);
        setResendMsg('');
        try {
            await apiRequest('/api/auth/resend-verification', {
                method: 'POST',
                body: JSON.stringify({ email: email.trim() }),
            });
            setResendMsg('If that account exists and is unverified, we sent a new verification email.');
        } catch (err) {
            setResendMsg(err.message || 'Could not send verification email.');
        } finally {
            setResendLoading(false);
        }
    };

    return (
        <PageTransition>
            <SEOHead {...loginSEO} />
            <div className="container" style={{ minHeight: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem 1rem' }}>
                <div className="card" style={{ maxWidth: '440px', width: '100%', padding: '2.5rem' }}>
                    <h2 className="section-title" style={{ fontSize: '2rem', marginBottom: '0.5rem', textAlign: 'center' }}>Welcome Back</h2>
                    <p style={{ color: 'var(--text-muted)', marginBottom: '1.75rem', textAlign: 'center', fontSize: '0.95rem' }}>
                        Sign in to continue to Bylot marketplace
                    </p>

                    {error && (
                        <div style={{
                            padding: '0.75rem 1rem',
                            marginBottom: '1.25rem',
                            borderRadius: 'var(--radius-sm, 8px)',
                            backgroundColor: 'rgba(239, 68, 68, 0.1)',
                            border: '1px solid rgba(239, 68, 68, 0.3)',
                            color: '#dc2626',
                            fontSize: '0.88rem',
                            fontWeight: '500'
                        }}>
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleEmailLogin} style={{ display: 'grid', gap: '1rem' }}>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                            <label className="form-label" htmlFor="email" style={{ display: 'block', marginBottom: '0.35rem', fontWeight: 600, fontSize: '0.88rem' }}>
                                Email Address
                            </label>
                            <input
                                type="email"
                                id="email"
                                name="email"
                                className="form-input"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="name@example.com"
                                autoComplete="email"
                                required
                            />
                        </div>

                        <div className="form-group" style={{ marginBottom: 0 }}>
                            <label className="form-label" htmlFor="password" style={{ display: 'block', marginBottom: '0.35rem', fontWeight: 600, fontSize: '0.88rem' }}>
                                Password
                            </label>
                            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    id="password"
                                    name="password"
                                    className="form-input"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="••••••••"
                                    autoComplete="current-password"
                                    required
                                    style={{ paddingRight: '2.75rem' }}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword((p) => !p)}
                                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                                    style={{
                                        position: 'absolute',
                                        right: '0.75rem',
                                        background: 'none',
                                        border: 'none',
                                        cursor: 'pointer',
                                        color: 'var(--text-muted)',
                                        fontSize: '1.1rem',
                                        padding: '0.25rem',
                                        display: 'grid',
                                        placeItems: 'center'
                                    }}
                                >
                                    {showPassword ? <FaEyeSlash /> : <FaEye />}
                                </button>
                            </div>
                        </div>

                        <button
                            type="submit"
                            className="btn btn-primary"
                            disabled={loading}
                            style={{
                                width: '100%',
                                marginTop: '0.5rem',
                                padding: '0.85rem',
                                fontWeight: 700,
                                fontSize: '1rem',
                                cursor: loading ? 'not-allowed' : 'pointer'
                            }}
                        >
                            {loading ? 'Signing in...' : 'Sign In'}
                        </button>
                    </form>

                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        margin: '1.5rem 0',
                        color: 'var(--text-muted)',
                        fontSize: '0.85rem'
                    }}>
                        <div style={{ flex: 1, height: '1px', backgroundColor: 'var(--border, rgba(150, 150, 150, 0.2))' }} />
                        <span style={{ padding: '0 0.75rem', fontWeight: 600 }}>OR</span>
                        <div style={{ flex: 1, height: '1px', backgroundColor: 'var(--border, rgba(150, 150, 150, 0.2))' }} />
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'center', minHeight: '44px' }}>
                        {isGoogleConfigured ? (
                            <GoogleLogin
                                onSuccess={handleGoogleSuccess}
                                onError={handleGoogleError}
                                useOneTap
                                text="signin_with"
                                shape="rectangular"
                                width="300"
                            />
                        ) : (
                            <div style={{
                                padding: '0.75rem 1rem',
                                backgroundColor: 'var(--bg-surface, rgba(0,0,0,0.03))',
                                border: '1px dashed var(--border, #cbd5e1)',
                                borderRadius: 'var(--radius-sm, 8px)',
                                fontSize: '0.82rem',
                                color: 'var(--text-muted, #64748b)',
                                textAlign: 'center',
                                width: '100%'
                            }}>
                                ℹ️ Google Sign-In requires <code>VITE_GOOGLE_CLIENT_ID</code> to be configured in your environment.
                            </div>
                        )}
                    </div>

                    <div style={{ marginTop: '1.25rem', textAlign: 'center' }}>
                        <button
                            type="button"
                            className="btn btn-secondary"
                            style={{ width: '100%', minHeight: '44px', fontSize: '0.92rem' }}
                            disabled={resendLoading}
                            onClick={handleResendVerification}
                        >
                            {resendLoading ? 'Sending…' : 'Resend verification email'}
                        </button>
                        {resendMsg && (
                            <p style={{ marginTop: '0.75rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>{resendMsg}</p>
                        )}
                    </div>

                    <div style={{ marginTop: '1.75rem', textAlign: 'center' }}>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.92rem' }}>
                            Don't have an account?{' '}
                            <Link to="/register" style={{ color: 'var(--primary)', fontWeight: '700', textDecoration: 'none' }}>
                                Create Account
                            </Link>
                        </p>
                        <p style={{ marginTop: '0.5rem', fontSize: '0.92rem' }}>
                            <Link to="/reset-password" style={{ color: 'var(--primary)', fontWeight: '600' }}>Forgot password?</Link>
                        </p>
                    </div>
                </div>
            </div>
        </PageTransition>
    );
};

export default Login;
