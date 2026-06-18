import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import PageTransition from '../components/PageTransition';
import { GoogleLogin } from '@react-oauth/google';
import { useAuth } from '../context/AuthContext';
import { apiRequest } from '../api/backendApi';

const Login = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const from = location.state?.from || '/';
    const { login } = useAuth();

    const handleGoogleSuccess = async (credentialResponse) => {
        try {
            const data = await apiRequest('/api/auth/google-login', {
                method: 'POST',
                body: JSON.stringify({ idToken: credentialResponse.credential }),
            });
            const user = data.data?.user || data.user;
            const accessToken = data.data?.accessToken || data.user?.token;
            login({ ...user, accessToken });
            navigate(from, { replace: true });
        } catch (err) {
            console.error('Google login error:', err);
            alert(err.message || 'Login failed. Please try again.');
        }
    };

    return (
        <PageTransition>
            <div className="container" style={{ minHeight: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div className="card" style={{ maxWidth: '400px', width: '100%', textAlign: 'center' }}>
                    <h2 className="section-title" style={{ fontSize: '2rem', marginBottom: '1.5rem' }}>Welcome Back</h2>
                    <p style={{ color: 'var(--text-muted)', marginBottom: '2rem' }}>
                        Sign in with Google to continue to Bylot
                    </p>
                    <div style={{ display: 'flex', justifyContent: 'center' }}>
                        <GoogleLogin
                            onSuccess={handleGoogleSuccess}
                            onError={() => alert('Google sign in failed. Please try again.')}
                            width="300"
                        />
                    </div>
                </div>
            </div>
        </PageTransition>
    );
};

export default Login;
