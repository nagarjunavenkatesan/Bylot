import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FaEye, FaEyeSlash } from 'react-icons/fa';
import { motion } from 'framer-motion';
import PageTransition from '../components/PageTransition';
import { GoogleLogin } from '@react-oauth/google';
import { useAuth } from '../context/AuthContext';

const Register = () => {
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        phone: '',
        otp: '',
        password: '',
        confirmPassword: ''
    });
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [otpSent, setOtpSent] = useState(false);
    const [otpVerified, setOtpVerified] = useState(false);
    const navigate = useNavigate();
    const { login } = useAuth();

    const handleChange = (e) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value
        });
    };

    const handleSendOtp = async () => {
        if (!formData.phone) {
            alert('Please enter a phone number');
            return;
        }
        try {
            const response = await fetch('/api/auth/send-otp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phone: formData.phone })
            });
            const data = await response.json();
            if (response.ok) {
                setOtpSent(true);
                if (data.otp) {
                    setFormData(prev => ({ ...prev, otp: data.otp }));
                    alert(`OTP Sent: ${data.otp}`);
                } else {
                    alert('OTP sent successfully (Check server console)');
                }
            } else {
                alert(data.message || 'Failed to send OTP');
            }
        } catch (error) {
            console.error('Error sending OTP:', error);
            alert('Error sending OTP');
        }
    };

    const handleVerifyOtp = async () => {
        if (!formData.otp) {
            alert('Please enter the OTP');
            return;
        }
        try {
            const response = await fetch('/api/auth/verify-otp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phone: formData.phone, otp: formData.otp })
            });
            const data = await response.json();
            if (response.ok) {
                setOtpVerified(true);
                alert('OTP Verified Successfully!');
            } else {
                alert(data.message || 'Invalid OTP');
            }
        } catch (error) {
            console.error('Error verifying OTP:', error);
            alert('Error verifying OTP');
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!otpVerified) {
            alert('Please verify OTP first');
            return;
        }
        if (formData.password !== formData.confirmPassword) {
            alert('Passwords do not match');
            return;
        }

        try {
            const response = await fetch('/api/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: formData.name,
                    email: formData.email,
                    phone: formData.phone,
                    password: formData.password
                })
            });
            const data = await response.json();
            if (response.ok) {
                alert('Registration Successful!');
                navigate('/login');
            } else {
                alert(data.message || 'Registration failed');
            }
        } catch (error) {
            console.error('Error registering:', error);
            alert('Error registering');
        }
    };

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
                    <h2 className="section-title" style={{ fontSize: '2rem', marginBottom: '1.5rem', textAlign: 'center' }}>Create Account</h2>
                    <p className="text-center" style={{ color: 'var(--text-muted)', marginBottom: '2rem' }}>
                        Join Bylot today
                    </p>

                    <form onSubmit={handleSubmit}>
                        <div className="form-group">
                            <label className="form-label" htmlFor="name">Full Name</label>
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

                        <div className="form-group">
                            <label className="form-label" htmlFor="email">Email Address</label>
                            <input
                                type="email"
                                id="email"
                                name="email"
                                className="form-input"
                                value={formData.email}
                                onChange={handleChange}
                                placeholder="name@example.com"
                                required
                            />
                        </div>

                        <div className="form-group">
                            <label className="form-label" htmlFor="phone">Phone Number</label>
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <input
                                    type="tel"
                                    id="phone"
                                    name="phone"
                                    className="form-input"
                                    value={formData.phone}
                                    onChange={handleChange}
                                    placeholder="+91 98765 43210"
                                    required
                                    disabled={otpVerified}
                                />
                                {!otpVerified && (
                                    <button
                                        type="button"
                                        className="btn btn-secondary"
                                        onClick={handleSendOtp}
                                        style={{ whiteSpace: 'nowrap', fontSize: '0.85rem', padding: '0.5rem 1rem' }}
                                    >
                                        {otpSent ? 'Resend' : 'Send OTP'}
                                    </button>
                                )}
                            </div>
                        </div>

                        {otpSent && !otpVerified && (
                            <div className="form-group">
                                <label className="form-label" htmlFor="otp">Enter OTP</label>
                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                    <input
                                        type="text"
                                        id="otp"
                                        name="otp"
                                        className="form-input"
                                        value={formData.otp}
                                        onChange={handleChange}
                                        placeholder="123456"
                                        required
                                    />
                                    <button
                                        type="button"
                                        className="btn btn-primary"
                                        onClick={handleVerifyOtp}
                                        style={{ whiteSpace: 'nowrap', fontSize: '0.85rem', padding: '0.5rem 1rem' }}
                                    >
                                        Verify
                                    </button>
                                </div>
                                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                                    OTP sent to server console (Mock)
                                </p>
                            </div>
                        )}

                        {otpVerified && (
                            <div className="form-group">
                                <div style={{ color: 'green', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <span>✓</span> Phone Verified
                                </div>
                            </div>
                        )}

                        <div className="form-group">
                            <label className="form-label" htmlFor="password">Password</label>
                            <div style={{ position: 'relative' }}>
                                <input
                                    type={showPassword ? "text" : "password"}
                                    id="password"
                                    name="password"
                                    className="form-input"
                                    value={formData.password}
                                    onChange={handleChange}
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

                        <div className="form-group">
                            <label className="form-label" htmlFor="confirmPassword">Confirm Password</label>
                            <div style={{ position: 'relative' }}>
                                <input
                                    type={showConfirmPassword ? "text" : "password"}
                                    id="confirmPassword"
                                    name="confirmPassword"
                                    className="form-input"
                                    value={formData.confirmPassword}
                                    onChange={handleChange}
                                    placeholder="••••••••"
                                    required
                                    style={{ paddingRight: '2.5rem' }}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
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
                                    {showConfirmPassword ? <FaEyeSlash /> : <FaEye />}
                                </button>
                            </div>
                        </div>

                        <button
                            type="submit"
                            className="btn btn-primary w-full"
                            style={{ width: '100%', marginTop: '1rem', opacity: otpVerified ? 1 : 0.7, cursor: otpVerified ? 'pointer' : 'not-allowed' }}
                            disabled={!otpVerified}
                        >
                            Create Account
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
                                            login(data.user);
                                            navigate('/');
                                        } else {
                                            alert(data.message || 'Google Sign-Up Failed');
                                        }
                                    } catch (err) {
                                        console.error(err);
                                        alert('Google Sign-Up Error');
                                    }
                                }}
                                onError={() => {
                                    console.log('Sign-Up Failed');
                                    alert('Google Sign-Up Failed');
                                }}
                                text="signup_with"
                            />
                        </div>
                    </form>

                    <div className="text-center mt-4" style={{ marginTop: '1.5rem' }}>
                        <p style={{ color: 'var(--text-muted)' }}>
                            Already have an account?{' '}
                            <Link to="/login" style={{ color: 'var(--primary)', fontWeight: '600' }}>
                                Sign In
                            </Link>
                        </p>
                    </div>
                </motion.div>
            </div>
        </PageTransition>
    );
};

export default Register;
