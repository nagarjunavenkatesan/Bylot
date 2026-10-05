import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FaEye, FaEyeSlash } from 'react-icons/fa';
import { GoogleLogin } from '@react-oauth/google';
import PageTransition from '../components/PageTransition';
import SEOHead from '../components/SEOHead';
import { pageSEO } from '../utils/seo';
import { useAuth } from '../context/AuthContext';

const registerSEO = pageSEO({
    title: 'Create an Account',
    description: 'Register for a Bylot account to start buying or selling discounted groceries and near-expiry goods.',
    path: '/register',
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

const Register = () => {
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        phone: '',
        password: '',
        confirmPassword: ''
    });
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [successMessage, setSuccessMessage] = useState('');

    const navigate = useNavigate();
    const { login, user } = useAuth();
    const { isConfigured: isGoogleConfigured } = useGoogleAuth();

    useEffect(() => {
        if (user) {
            navigate(getRedirectPath(user.role), { replace: true });
        }
    }, [user, navigate]);

    const handleChange = (e) => {
        setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
        setError('');
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
            navigate(getRedirectPath(userData.role), { replace: true });
        } catch (err) {
            setError(err.message || 'Google sign-up failed. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleGoogleError = () => {
        setError('Google sign-up was cancelled or failed. Please try again.');
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setSuccessMessage('');

        if (formData.password.length < 6) {
            setError('Password must be at least 6 characters long.');
            return;
        }

        if (formData.password !== formData.confirmPassword) {
            setError('Passwords do not match.');
            return;
        }

        setLoading(true);
        try {
            const data = await apiRequest('/api/auth/register', {
                method: 'POST',
                body: JSON.stringify({
                    name: formData.name.trim(),
                    email: formData.email.trim().toLowerCase(),
                    phone: formData.phone.trim() || undefined,
                    password: formData.password,
                }),
            });

            const userData = data.data?.user || data.user;
            const accessToken = data.data?.accessToken || data.accessToken || data.user?.token;

            if (userData && accessToken) {
                login({ ...userData, accessToken });
                navigate(getRedirectPath(userData.role), { replace: true });
            } else {
                setSuccessMessage('Registration successful! Redirecting to login...');
                setTimeout(() => navigate('/login'), 1500);
            }
        } catch (err) {
            setError(err.message || 'Registration failed. Please check your information.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <PageTransition>
            <SEOHead {...registerSEO} />
            <div className="container" style={{ minHeight: '85vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem 1rem' }}>
                <div className="card" style={{ maxWidth: '440px', width: '100%', padding: '2.5rem' }}>
                    <h2 className="section-title" style={{ fontSize: '2rem', marginBottom: '0.5rem', textAlign: 'center' }}>Create Account</h2>
                    <p style={{ color: 'var(--text-muted)', marginBottom: '1.75rem', textAlign: 'center', fontSize: '0.95rem' }}>
                        Join Bylot to save on groceries and reduce food waste
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

                    {successMessage && (
                        <div style={{
                            padding: '0.75rem 1rem',
                            marginBottom: '1.25rem',
                            borderRadius: 'var(--radius-sm, 8px)',
                            backgroundColor: 'rgba(16, 185, 129, 0.1)',
                            border: '1px solid rgba(16, 185, 129, 0.3)',
                            color: '#059669',
                            fontSize: '0.88rem',
                            fontWeight: '500'
                        }}>
                            {successMessage}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '0.9rem' }}>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                            <label className="form-label" htmlFor="name" style={{ display: 'block', marginBottom: '0.35rem', fontWeight: 600, fontSize: '0.88rem' }}>
                                Full Name
                            </label>
                            <input
                                type="text"
                                id="name"
                                name="name"
                                className="form-input"
                                value={formData.name}
                                onChange={handleChange}
                                placeholder="John Doe"
                                required
                            />
                        </div>

                        <div className="form-group" style={{ marginBottom: 0 }}>
                            <label className="form-label" htmlFor="email" style={{ display: 'block', marginBottom: '0.35rem', fontWeight: 600, fontSize: '0.88rem' }}>
                                Email Address
                            </label>
                            <input
                                type="email"
                                id="email"
                                name="email"
                                className="form-input"
                                value={formData.email}
                                onChange={handleChange}
                                placeholder="name@example.com"
                                autoComplete="email"
                                required
                            />
                        </div>

                        <div className="form-group" style={{ marginBottom: 0 }}>
                            <label className="form-label" htmlFor="phone" style={{ display: 'block', marginBottom: '0.35rem', fontWeight: 600, fontSize: '0.88rem' }}>
                                Phone Number (Optional)
                            </label>
                            <input
                                type="tel"
                                id="phone"
                                name="phone"
                                className="form-input"
                                value={formData.phone}
                                onChange={handleChange}
                                placeholder="+91 98765 43210"
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
                                    value={formData.password}
                                    onChange={handleChange}
                                    placeholder="At least 6 characters"
                                    autoComplete="new-password"
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

                        <div className="form-group" style={{ marginBottom: 0 }}>
                            <label className="form-label" htmlFor="confirmPassword" style={{ display: 'block', marginBottom: '0.35rem', fontWeight: 600, fontSize: '0.88rem' }}>
                                Confirm Password
                            </label>
                            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                                <input
                                    type={showConfirmPassword ? 'text' : 'password'}
                                    id="confirmPassword"
                                    name="confirmPassword"
                                    className="form-input"
                                    value={formData.confirmPassword}
                                    onChange={handleChange}
                                    placeholder="Re-enter your password"
                                    autoComplete="new-password"
                                    required
                                    style={{ paddingRight: '2.75rem' }}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowConfirmPassword((p) => !p)}
                                    aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
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
                                    {showConfirmPassword ? <FaEyeSlash /> : <FaEye />}
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
                            {loading ? 'Creating Account...' : 'Create Account'}
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
                                text="signup_with"
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
                                ℹ️ Google Sign-Up requires <code>VITE_GOOGLE_CLIENT_ID</code> to be configured.
                            </div>
                        )}
                    </div>

                    <div style={{ marginTop: '1.75rem', textAlign: 'center' }}>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.92rem' }}>
                            Already have an account?{' '}
                            <Link to="/login" style={{ color: 'var(--primary)', fontWeight: '700', textDecoration: 'none' }}>
                                Sign In
                            </Link>
                        </p>
                    </div>
                </div>
            </div>
        </PageTransition>
    );
};

export default Register;
