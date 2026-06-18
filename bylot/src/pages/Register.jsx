import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FaEye, FaEyeSlash } from 'react-icons/fa';
import { motion } from 'framer-motion';
import PageTransition from '../components/PageTransition';
import { GoogleLogin } from '@react-oauth/google';
import { useAuth } from '../context/AuthContext';
import { apiRequest } from '../api/backendApi';

const Register = () => {
    const [formData, setFormData] = useState({ name: '', email: '', phone: '', otp: '', password: '', confirmPassword: '', _mockOtp: '' });
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [otpSent, setOtpSent] = useState(false);
    const [otpVerified, setOtpVerified] = useState(false);
    const navigate = useNavigate();
    const { login } = useAuth();

    const handleChange = e => setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));

    const handleSendOtp = () => {
        if (!formData.phone) { alert('Please enter a phone number'); return; }
        const mockOtp = Math.floor(100000 + Math.random() * 900000).toString();
        setFormData(prev => ({ ...prev, _mockOtp: mockOtp }));
        setOtpSent(true);
        alert(`Demo OTP: ${mockOtp}`);
    };

    const handleVerifyOtp = () => {
        if (!formData.otp) { alert('Please enter the OTP'); return; }
        if (formData.otp === formData._mockOtp) { setOtpVerified(true); alert('Phone Verified!'); }
        else alert('Incorrect OTP. Please try again.');
    };

    const handleSubmit = async e => {
        e.preventDefault();
        if (formData.password !== formData.confirmPassword) { alert('Passwords do not match'); return; }
        try {
            await apiRequest('/api/auth/register', {
                method: 'POST',
                body: JSON.stringify({ name: formData.name, email: formData.email, phone: formData.phone, password: formData.password }),
            });
            alert('Registration Successful! Please sign in.');
            navigate('/login');
        } catch (err) {
            alert(err.message || 'Registration failed');
        }
    };

    return (
        <PageTransition>
            <div className="container" style={{ minHeight: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <motion.div className="card" style={{ maxWidth: '400px', width: '100%' }} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.5 }}>
                    <h2 className="section-title" style={{ fontSize: '2rem', marginBottom: '1.5rem', textAlign: 'center' }}>Create Account</h2>
                    <p style={{ color: 'var(--text-muted)', marginBottom: '2rem', textAlign: 'center' }}>Join Bylot today</p>

                    <form onSubmit={handleSubmit}>
                        <div className="form-group">
                            <label className="form-label" htmlFor="name">Full Name</label>
                            <input type="text" id="name" name="name" className="form-input" value={formData.name} onChange={handleChange} placeholder="John Doe" required />
                        </div>
                        <div className="form-group">
                            <label className="form-label" htmlFor="email">Email Address</label>
                            <input type="email" id="email" name="email" className="form-input" value={formData.email} onChange={handleChange} placeholder="name@example.com" required />
                        </div>
                        <div className="form-group">
                            <label className="form-label" htmlFor="phone">Phone Number</label>
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <input type="tel" id="phone" name="phone" className="form-input" value={formData.phone} onChange={handleChange} placeholder="+91 98765 43210" disabled={otpVerified} />
                                {!otpVerified && (
                                    <button type="button" className="btn btn-secondary" onClick={handleSendOtp} style={{ whiteSpace: 'nowrap', fontSize: '0.85rem', padding: '0.5rem 1rem' }}>
                                        {otpSent ? 'Resend' : 'Send OTP'}
                                    </button>
                                )}
                            </div>
                        </div>
                        {otpSent && !otpVerified && (
                            <div className="form-group">
                                <label className="form-label" htmlFor="otp">Enter OTP</label>
                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                    <input type="text" id="otp" name="otp" className="form-input" value={formData.otp} onChange={handleChange} placeholder="123456" />
                                    <button type="button" className="btn btn-primary" onClick={handleVerifyOtp} style={{ whiteSpace: 'nowrap', fontSize: '0.85rem', padding: '0.5rem 1rem' }}>Verify</button>
                                </div>
                            </div>
                        )}
                        {otpVerified && <div className="form-group"><div style={{ color: 'green', fontSize: '0.9rem' }}>✓ Phone Verified</div></div>}
                        <div className="form-group">
                            <label className="form-label" htmlFor="password">Password</label>
                            <div style={{ position: 'relative' }}>
                                <input type={showPassword ? 'text' : 'password'} id="password" name="password" className="form-input" value={formData.password} onChange={handleChange} placeholder="••••••••" required style={{ paddingRight: '2.5rem' }} />
                                <button type="button" onClick={() => setShowPassword(p => !p)} style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                                    {showPassword ? <FaEyeSlash /> : <FaEye />}
                                </button>
                            </div>
                        </div>
                        <div className="form-group">
                            <label className="form-label" htmlFor="confirmPassword">Confirm Password</label>
                            <div style={{ position: 'relative' }}>
                                <input type={showConfirmPassword ? 'text' : 'password'} id="confirmPassword" name="confirmPassword" className="form-input" value={formData.confirmPassword} onChange={handleChange} placeholder="••••••••" required style={{ paddingRight: '2.5rem' }} />
                                <button type="button" onClick={() => setShowConfirmPassword(p => !p)} style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                                    {showConfirmPassword ? <FaEyeSlash /> : <FaEye />}
                                </button>
                            </div>
                        </div>
                        <button type="submit" className="btn btn-primary w-full" style={{ width: '100%', marginTop: '1rem' }}>Create Account</button>

                        <div style={{ margin: '1.5rem 0', textAlign: 'center' }}>
                            <hr style={{ borderTop: '1px solid var(--border-color)' }} />
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>OR</span>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'center' }}>
                            <GoogleLogin
                                onSuccess={async cr => {
                                    try {
                                        const data = await apiRequest('/api/auth/google-login', {
                                            method: 'POST',
                                            body: JSON.stringify({ idToken: cr.credential }),
                                        });
                                        login({ ...data.data.user, accessToken: data.data.accessToken });
                                        navigate('/');
                                    } catch (err) {
                                        alert(err.message || 'Google Sign-Up Error');
                                    }
                                }}
                                onError={() => alert('Google Sign-Up Failed')}
                                text="signup_with"
                            />
                        </div>
                    </form>

                    <div style={{ marginTop: '1.5rem', textAlign: 'center' }}>
                        <p style={{ color: 'var(--text-muted)' }}>
                            Already have an account?{' '}
                            <Link to="/login" style={{ color: 'var(--primary)', fontWeight: '600' }}>Sign In</Link>
                        </p>
                    </div>
                </motion.div>
            </div>
        </PageTransition>
    );
};

export default Register;
