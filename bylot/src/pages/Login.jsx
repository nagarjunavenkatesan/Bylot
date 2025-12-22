import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { FaEye, FaEyeSlash } from 'react-icons/fa';
import { motion } from 'framer-motion';
import PageTransition from '../components/PageTransition';
import { GoogleLogin } from '@react-oauth/google';
import { useAuth } from '../context/AuthContext';

const Login = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const navigate = useNavigate();
    const location = useLocation();
    const from = location.state?.from || '/';
    const { login } = useAuth();

    const handleSubmit = async (e) => {
        e.preventDefault();

        try {
            const response = await fetch('/api/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ email, password }),
            });

            const data = await response.json();

            if (response.ok) {
                login(data.user);
                navigate(from, { replace: true });
            } else {
                alert(data.message || 'Login failed');
            }
        } catch (error) {
            console.error('Login error:', error);
            alert(`An error occurred: ${error.message}`);
        }
    };
// ... (middle of file unchanged) ...
                        <div style={{ display: 'flex', justifyContent: 'center' }}>
                            <GoogleLogin
                                onSuccess={async (credentialResponse) => {
                                    try {
                                        const res = await fetch('/api/auth/google', {
                                            method: 'POST',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify({ token: credentialResponse.credential })
                                        });
                                        const data = await res.json();
                                        if (res.ok) {
                                            login(data.user);
                                            navigate(from, { replace: true });
                                        } else {
                                            alert(data.message || 'Google Login Failed');
                                        }
                                    } catch (err) {
                                        console.error(err);
                                        alert('Google Login Error');
                                    }
                                }}
                                onError={() => {
                                    console.log('Login Failed');
                                    alert('Google Login Failed');
                                }}
                                width="300" // approximate
                            />
                        </div>

    return (
        <PageTransition>
            <div className="container" style={{ minHeight: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <motion.div
                    className="card"
                    style={{ maxWidth: '400px', width: '100%' }}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.5, ease: "easeOut" }}
                >
                    <h2 className="section-title" style={{ fontSize: '2rem', marginBottom: '1.5rem', textAlign: 'center' }}>Welcome Back</h2>
                    <p className="text-center" style={{ color: 'var(--text-muted)', marginBottom: '2rem' }}>
                        Sign in to continue to Bylot
                    </p>

                    <form onSubmit={handleSubmit}>
                        <div className="form-group">
                            <label className="form-label" htmlFor="email">Email Address</label>
                            <input
                                type="email"
                                id="email"
                                className="form-input"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="name@example.com"
                                required
                            />
                        </div>

                        <div className="form-group">
                            <label className="form-label" htmlFor="password">Password</label>
                            <div style={{ position: 'relative' }}>
                                <input
                                    type={showPassword ? "text" : "password"}
                                    id="password"
                                    className="form-input"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="••••••••"
                                    required
                                    style={{ paddingRight: '2.5rem' }}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    style={{
                                        position: 'absolute',
                                        right: '0.75rem',
                                        top: '50%',
                                        transform: 'translateY(-50%)',
                                        background: 'none',
                                        border: 'none',
                                        cursor: 'pointer',
                                        color: 'var(--text-muted)',
                                        display: 'flex',
                                        alignItems: 'center'
                                    }}
                                >
                                    {showPassword ? <FaEyeSlash /> : <FaEye />}
                                </button>
                            </div>
                        </div>

                        <button type="submit" className="btn btn-primary w-full" style={{ width: '100%', marginTop: '1rem' }}>
                            Sign In
                        </button>

                        <div style={{ margin: '1.5rem 0', textAlign: 'center', position: 'relative' }}>
                             <hr style={{ borderTop: '1px solid var(--border-color)', marginBottom: '0.75rem' }} />
                             <span style={{ position: 'absolute', top: '-12px', left: '50%', transform: 'translateX(-50%)', background: 'var(--card-bg)', padding: '0 0.5rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>OR</span>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'center' }}>
                            <GoogleLogin
                                onSuccess={async (credentialResponse) => {
                                    try {
                                        const res = await fetch('/api/auth/google', {
                                            method: 'POST',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify({ token: credentialResponse.credential })
                                        });
                                        const data = await res.json();
                                        if (res.ok) {
                                            localStorage.setItem('user', JSON.stringify(data.user));
                                            navigate(from, { replace: true });
                                        } else {
                                            alert(data.message || 'Google Login Failed');
                                        }
                                    } catch (err) {
                                        console.error(err);
                                        alert('Google Login Error');
                                    }
                                }}
                                onError={() => {
                                    console.log('Login Failed');
                                    alert('Google Login Failed');
                                }}
                                width="300" // approximate
                            />
                        </div>
                    </form>

                    <div className="text-center mt-4" style={{ marginTop: '1.5rem' }}>
                        <p style={{ color: 'var(--text-muted)' }}>
                            Don't have an account?{' '}
                            <Link to="/register" style={{ color: 'var(--primary)', fontWeight: '600' }}>
                                Register
                            </Link>
                        </p>
                    </div>
                </motion.div>
            </div>
        </PageTransition>
    );
};

export default Login;
