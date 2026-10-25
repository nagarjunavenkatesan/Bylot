import React, { useState, useRef, useEffect } from 'react';
import {
    FaShieldAlt,
    FaKey,
    FaCopy,
    FaCheck,
    FaLock,
    FaArrowLeft
} from 'react-icons/fa';
import { apiRequest } from '../api/backendApi';
import '../styles/TwoFactorAuth.css';

const TwoFactorAuthFlow = ({ challengeData, onSuccess, onCancel }) => {
    const rawData = challengeData?.data || challengeData || {};
    // Mode can be: 'verify', 'recovery', 'setup', 'setup_complete'
    const initialMode = rawData?.requires2FASetup ? 'setup' : 'verify';
    const [mode, setMode] = useState(initialMode);

    // 6 individual digit boxes for TOTP
    const [digits, setDigits] = useState(['', '', '', '', '', '']);
    const inputRefs = useRef([]);

    // Single backup recovery code
    const [recoveryCode, setRecoveryCode] = useState('');

    // Setup mode states
    const [showManualKey, setShowManualKey] = useState(false);
    const [copiedKey, setCopiedKey] = useState(false);
    const [generatedRecoveryCodes, setGeneratedRecoveryCodes] = useState([]);
    const [savedCodesConfirmed, setSavedCodesConfirmed] = useState(false);
    const [copiedAllCodes, setCopiedAllCodes] = useState(false);

    // Status states
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const challengeId = rawData?.challengeId;
    const manualKey = rawData?.manualEntryKey || rawData?.manualKey;
    const qrCodeUrl = rawData?.qrCodeDataUrl || rawData?.qrCodeUrl;

    // Automatically focus the first input whenever entering verification or setup mode
    useEffect(() => {
        if (mode === 'verify' || mode === 'setup') {
            const timer = setTimeout(() => {
                inputRefs.current[0]?.focus();
            }, 60);
            return () => clearTimeout(timer);
        }
    }, [mode]);

    // Handle typing a digit into one of the 6 individual boxes
    const handleDigitChange = (index, value) => {
        // Reject letters and special characters - only numeric digits (0-9)
        const clean = value.replace(/\D/g, '');
        if (!clean) {
            const newDigits = [...digits];
            newDigits[index] = '';
            setDigits(newDigits);
            return;
        }

        const char = clean[clean.length - 1];
        const newDigits = [...digits];
        newDigits[index] = char;
        setDigits(newDigits);

        // Automatically move to the next box
        if (index < 5 && char) {
            inputRefs.current[index + 1]?.focus();
        }
    };

    // Handle backspace navigation and arrow keys
    const handleKeyDown = (index, e) => {
        if (e.key === 'Backspace') {
            if (digits[index]) {
                const newDigits = [...digits];
                newDigits[index] = '';
                setDigits(newDigits);
            } else if (index > 0) {
                // Move to previous box and clear it
                const newDigits = [...digits];
                newDigits[index - 1] = '';
                setDigits(newDigits);
                inputRefs.current[index - 1]?.focus();
            }
        } else if (e.key === 'ArrowLeft' && index > 0) {
            inputRefs.current[index - 1]?.focus();
        } else if (e.key === 'ArrowRight' && index < 5) {
            inputRefs.current[index + 1]?.focus();
        }
    };

    // Support pasting a 6-digit code into any box
    const handlePaste = (e) => {
        e.preventDefault();
        const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
        if (!pasted) return;

        const newDigits = [...digits];
        for (let i = 0; i < 6; i++) {
            newDigits[i] = pasted[i] || '';
        }
        setDigits(newDigits);

        const nextFocus = Math.min(pasted.length, 5);
        inputRefs.current[nextFocus]?.focus();
    };

    const fullCode = digits.join('');
    const isCodeComplete = fullCode.length === 6;

    // Handle 6-digit TOTP verification
    const handleVerifyTotp = async (e) => {
        e.preventDefault();
        if (loading || !isCodeComplete) return;

        setLoading(true);
        setError('');
        try {
            const res = await apiRequest('/api/admin/2fa/verify-login', {
                method: 'POST',
                body: JSON.stringify({ challengeId, code: fullCode })
            });
            onSuccess(res.data || res);
        } catch (err) {
            setError(err.message || 'Invalid verification code. Please try again.');
            setDigits(['', '', '', '', '', '']);
            setTimeout(() => {
                inputRefs.current[0]?.focus();
            }, 50);
        } finally {
            setLoading(false);
        }
    };

    // Handle single-use recovery code verification
    const handleVerifyRecovery = async (e) => {
        e.preventDefault();
        const cleanCode = recoveryCode.trim();
        if (loading || !cleanCode) return;

        setLoading(true);
        setError('');
        try {
            const res = await apiRequest('/api/admin/2fa/verify-recovery', {
                method: 'POST',
                body: JSON.stringify({ challengeId, recoveryCode: cleanCode })
            });
            onSuccess(res.data || res);
        } catch (err) {
            setError(err.message || 'Invalid verification code. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    // Handle first-time setup verification
    const handleVerifySetup = async (e) => {
        e.preventDefault();
        if (loading || !isCodeComplete) return;

        setLoading(true);
        setError('');
        try {
            const res = await apiRequest('/api/admin/2fa/verify-setup', {
                method: 'POST',
                body: JSON.stringify({ challengeId, code: fullCode })
            });

            const data = res.data || res;
            if (Array.isArray(data.recoveryCodes) && data.recoveryCodes.length > 0) {
                setGeneratedRecoveryCodes(data.recoveryCodes);
                window.__pendingAdminAuth = data;
                setMode('setup_complete');
            } else {
                onSuccess(data);
            }
        } catch (err) {
            setError(err.message || 'Invalid verification code. Please try again.');
            setDigits(['', '', '', '', '', '']);
            setTimeout(() => {
                inputRefs.current[0]?.focus();
            }, 50);
        } finally {
            setLoading(false);
        }
    };

    const handleCopyManualKey = () => {
        if (!manualKey) return;
        navigator.clipboard.writeText(manualKey);
        setCopiedKey(true);
        setTimeout(() => setCopiedKey(false), 2000);
    };

    const handleCopyAllCodes = () => {
        if (!generatedRecoveryCodes.length) return;
        navigator.clipboard.writeText(generatedRecoveryCodes.join('\n'));
        setCopiedAllCodes(true);
        setTimeout(() => setCopiedAllCodes(false), 2000);
    };

    const handleFinishSetup = () => {
        const payload = window.__pendingAdminAuth;
        delete window.__pendingAdminAuth;
        onSuccess(payload);
    };

    // ─────────────────────────────────────────────────────────────────────────
    // Screen 1: First-time setup complete (Show one-time recovery codes)
    // ─────────────────────────────────────────────────────────────────────────
    if (mode === 'setup_complete') {
        return (
            <div className="admin-login-panel two-factor-card">
                <div className="two-factor-header">
                    <div className="two-factor-icon-wrap success">
                        <FaCheck />
                    </div>
                    <h2 className="two-factor-title">2-Step Verification Enabled</h2>
                    <p className="two-factor-subtitle">
                        Save your emergency backup recovery codes in a secure password manager.
                        If you lose access to Google Authenticator, these codes are the only way to recover your account.
                    </p>
                </div>

                <div className="two-factor-recovery-grid" aria-label="Recovery codes">
                    {generatedRecoveryCodes.map((code, idx) => (
                        <div key={idx} className="two-factor-recovery-code">
                            {code}
                        </div>
                    ))}
                </div>

                <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.25rem' }}>
                    <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={handleCopyAllCodes}
                        style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
                    >
                        {copiedAllCodes ? <FaCheck style={{ color: '#10b981' }} /> : <FaCopy />}
                        {copiedAllCodes ? 'Copied to Clipboard' : 'Copy All Codes'}
                    </button>
                </div>

                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.65rem', marginBottom: '1.25rem', fontSize: '0.85rem' }}>
                    <input
                        type="checkbox"
                        id="confirmSaved"
                        checked={savedCodesConfirmed}
                        onChange={(e) => setSavedCodesConfirmed(e.target.checked)}
                        style={{ marginTop: '3px', cursor: 'pointer' }}
                    />
                    <label htmlFor="confirmSaved" style={{ color: 'var(--text-main, #334155)', cursor: 'pointer', lineHeight: 1.4 }}>
                        I have securely copied or saved these 10 recovery codes. I understand each code works once and they will never be shown again.
                    </label>
                </div>

                <button
                    type="button"
                    className="btn btn-primary two-factor-submit-btn"
                    disabled={!savedCodesConfirmed}
                    onClick={handleFinishSetup}
                >
                    CONTINUE TO ADMIN DASHBOARD
                </button>
            </div>
        );
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Screen 2: First-time setup (QR code & manual key + 6-digit OTP boxes)
    // ─────────────────────────────────────────────────────────────────────────
    if (mode === 'setup') {
        return (
            <div className="admin-login-panel two-factor-card">
                <div className="two-factor-header">
                    <div className="two-factor-icon-wrap setup">
                        <FaShieldAlt />
                    </div>
                    <h2 className="two-factor-title">2-Step Verification</h2>
                    <p className="two-factor-subtitle">
                        Please set up Google Authenticator to secure your administrator account.
                    </p>
                </div>

                {error && <div className="two-factor-alert error">{error}</div>}

                <ol className="two-factor-steps">
                    <li className="two-factor-step-item">
                        <span className="two-factor-step-num">1</span>
                        <span>Open <strong>Google Authenticator</strong> and tap <strong>+ Add account</strong>.</span>
                    </li>
                    <li className="two-factor-step-item">
                        <span className="two-factor-step-num">2</span>
                        <span>Scan this QR code with your camera:</span>
                    </li>
                </ol>

                {qrCodeUrl && (
                    <div className="two-factor-qr-wrap">
                        <img
                            src={qrCodeUrl}
                            alt="Scan this TOTP QR code in Google Authenticator"
                            className="two-factor-qr-img"
                        />
                    </div>
                )}

                <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
                    <button
                        type="button"
                        className="two-factor-toggle-btn"
                        onClick={() => setShowManualKey((prev) => !prev)}
                    >
                        {showManualKey ? 'Hide manual setup key' : "Can't scan QR code? Use manual key"}
                    </button>
                </div>

                {showManualKey && manualKey && (
                    <div className="two-factor-manual-key-box">
                        <span>{manualKey}</span>
                        <button
                            type="button"
                            onClick={handleCopyManualKey}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--primary, #4F46E5)' }}
                            title="Copy manual key"
                        >
                            {copiedKey ? <FaCheck style={{ color: '#10b981' }} /> : <FaCopy />}
                        </button>
                    </div>
                )}

                <form onSubmit={handleVerifySetup}>
                    <p style={{ textAlign: 'center', fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '0.75rem', fontWeight: 600 }}>
                        Step 3: Enter the 6-digit verification code from Google Authenticator
                    </p>

                    <div className="otp-boxes-container" role="group" aria-label="6-digit verification code">
                        {digits.map((digit, idx) => (
                            <input
                                key={idx}
                                ref={(el) => (inputRefs.current[idx] = el)}
                                type="text"
                                inputMode="numeric"
                                pattern="[0-9]*"
                                maxLength={1}
                                autoComplete={idx === 0 ? 'one-time-code' : 'off'}
                                aria-label={`Digit ${idx + 1} of 6`}
                                className={`otp-digit-box ${digit ? 'filled' : ''}`}
                                value={digit}
                                onChange={(e) => handleDigitChange(idx, e.target.value)}
                                onKeyDown={(e) => handleKeyDown(idx, e)}
                                onPaste={handlePaste}
                                disabled={loading}
                                required
                            />
                        ))}
                    </div>

                    <button
                        type="submit"
                        className="btn btn-primary two-factor-submit-btn"
                        disabled={loading || !isCodeComplete}
                    >
                        {loading ? 'VERIFYING...' : 'VERIFY CODE'}
                    </button>

                    {onCancel && (
                        <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={onCancel}
                            style={{ width: '100%', marginTop: '0.75rem' }}
                        >
                            Cancel
                        </button>
                    )}
                </form>
            </div>
        );
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Screen 3: Verification via Recovery Code
    // ─────────────────────────────────────────────────────────────────────────
    if (mode === 'recovery') {
        return (
            <div className="admin-login-panel two-factor-card">
                <div className="two-factor-header">
                    <div className="two-factor-icon-wrap">
                        <FaKey />
                    </div>
                    <h2 className="two-factor-title">2-Step Verification</h2>
                    <p className="two-factor-subtitle">
                        Please enter one of your Google Authenticator backup recovery codes.
                    </p>
                </div>

                {error && <div className="two-factor-alert error">{error}</div>}

                <div className="two-factor-recovery-section in-recovery">
                    <p className="two-factor-recovery-prompt">Can't access the code?</p>
                    <p className="two-factor-recovery-highlight">Use Google Backup Code</p>
                </div>

                <form onSubmit={handleVerifyRecovery}>
                    <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                        <input
                            type="text"
                            id="recoveryCodeInput"
                            className="form-input backup-code-input"
                            value={recoveryCode}
                            onChange={(e) => setRecoveryCode(e.target.value.toUpperCase())}
                            placeholder="Enter backup code"
                            aria-label="Enter backup code"
                            autoFocus
                            disabled={loading}
                            required
                        />
                    </div>

                    <button
                        type="submit"
                        className="btn btn-primary two-factor-submit-btn"
                        disabled={loading || !recoveryCode.trim()}
                    >
                        {loading ? 'VERIFYING...' : 'VERIFY BACKUP CODE'}
                    </button>

                    <div style={{ textAlign: 'center', marginTop: '1.25rem' }}>
                        <button
                            type="button"
                            className="two-factor-toggle-btn"
                            onClick={() => {
                                setMode('verify');
                                setError('');
                                setDigits(['', '', '', '', '', '']);
                            }}
                        >
                            Back to 6-digit authenticator code
                        </button>
                    </div>

                    {onCancel && (
                        <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={onCancel}
                            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', width: '100%', marginTop: '0.75rem' }}
                        >
                            <FaArrowLeft /> Back to Sign In
                        </button>
                    )}
                </form>
            </div>
        );
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Screen 4: Dedicated 2-Step Verification (6 Individual Digit Boxes)
    // ─────────────────────────────────────────────────────────────────────────
    return (
        <div className="admin-login-panel two-factor-card">
            <div className="two-factor-header">
                <div className="two-factor-icon-wrap">
                    <FaLock />
                </div>
                <h2 className="two-factor-title">2-Step Verification</h2>
                <p className="two-factor-subtitle">
                    Please enter the 6-digit verification code from the Google Authenticator app.
                </p>
            </div>

            {error && <div className="two-factor-alert error">{error}</div>}

            <form onSubmit={handleVerifyTotp} noValidate>
                {/* 6 Individual Digit Boxes: [ _ ] [ _ ] [ _ ] [ _ ] [ _ ] [ _ ] */}
                <div className="otp-boxes-container" role="group" aria-label="6-digit verification code">
                    {digits.map((digit, idx) => (
                        <input
                            key={idx}
                            ref={(el) => (inputRefs.current[idx] = el)}
                            type="text"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            maxLength={1}
                            autoComplete={idx === 0 ? 'one-time-code' : 'off'}
                            aria-label={`Digit ${idx + 1} of 6`}
                            className={`otp-digit-box ${digit ? 'filled' : ''}`}
                            value={digit}
                            onChange={(e) => handleDigitChange(idx, e.target.value)}
                            onKeyDown={(e) => handleKeyDown(idx, e)}
                            onPaste={handlePaste}
                            disabled={loading}
                            required
                        />
                    ))}
                </div>

                {/* VERIFY CODE Button */}
                <button
                    type="submit"
                    className="btn btn-primary two-factor-submit-btn"
                    disabled={loading || !isCodeComplete}
                >
                    {loading ? 'VERIFYING...' : 'VERIFY CODE'}
                </button>

                {/* Recovery Section: "Can't access the code?" -> "Use Google Backup Code" */}
                <div className="two-factor-recovery-section">
                    <p className="two-factor-recovery-prompt">Can't access the code?</p>
                    <button
                        type="button"
                        className="two-factor-recovery-link"
                        onClick={() => {
                            setMode('recovery');
                            setError('');
                            setRecoveryCode('');
                        }}
                    >
                        Use Google Backup Code
                    </button>
                </div>

                {onCancel && (
                    <div style={{ textAlign: 'center', marginTop: '1rem' }}>
                        <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={onCancel}
                            style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', width: '100%' }}
                        >
                            <FaArrowLeft /> Back to Sign In
                        </button>
                    </div>
                )}
            </form>
        </div>
    );
};

export default TwoFactorAuthFlow;
