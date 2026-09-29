import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { GoogleLogin } from '@react-oauth/google';
import PageTransition from '../components/PageTransition';
import { useAuth } from '../context/AuthContext';
import { apiRequest } from '../api/backendApi';

function getRedirectPath(role) {
    switch (role) {
        case 'admin': return '/admin';
        case 'seller': return '/sell';
        default: return '/';
    }
}

const Login = () => {
    const navigate = useNavigate();
    const { login, user } = useAuth();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (user) {
            navigate(getRedirectPath(user.role), { replace: true });
        }
    }, [user, navigate]);

    const handleGoogleSuccess = async (credentialResponse) => {
        setLoading(true);
        setError('');
        try {
            const data = await apiRequest('/api/auth/google-login', {
                method: 'POST',
                body: JSON.stringify({ idToken: credentialResponse.credential }),
            });
            const userData = data.data?.user || data.user;
            const accessToken = data.data?.accessToken || data.user?.token;
            login({ ...userData, accessToken });
            navigate(getRedirectPath(userData.role), { replace: true });
        } catch (err) {
            setError(err.message || 'Google sign-in failed. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleGoogleError = () => {
        setError('Google sign-in was cancelled or failed. Please try again.');
    };

    return (
        <PageTransition>
            <div className="container" style={{ minHeight: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div className="card" style={{ maxWidth: '400px', width: '100%', textAlign: 'center' }}>
                    <h2 className="section-title" style={{ fontSize: '2rem', marginBottom: '1.5rem' }}>Welcome Back</h2>
                    <p style={{ color: 'var(--text-muted)', marginBottom: '2rem' }}>
                        Sign in to continue to Bylot
                    </p>
                    {error && (
                        <p style={{ color: '#dc2626', marginBottom: '1rem', fontSize: '0.9rem' }}>{error}</p>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'center' }}>
                        <GoogleLogin
                            onSuccess={handleGoogleSuccess}
                            onError={handleGoogleError}
                            useOneTap
                            text="signin_with"
                            shape="rectangular"
                            width="300"
                        />
                    </div>
                    {loading && <p style={{ marginTop: '1rem', color: 'var(--text-muted)' }}>Signing in...</p>}

                </div>
            </div>
        </PageTransition>
    );
};

export default Login;
