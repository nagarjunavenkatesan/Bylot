import React, { useState, useEffect, useCallback } from 'react';
import {
    FaShieldAlt,
    FaKey,
    FaSync,
    FaTrashAlt,
    FaCheck,
    FaCopy,
    FaLock,
    FaExclamationTriangle,
    FaTimes
} from 'react-icons/fa';
import { API_BASE_URL, getAccessToken } from '../api/backendApi';
import TwoFactorAuthFlow from './TwoFactorAuthFlow';

const AdminTwoFactorSettings = () => {
    const [statusData, setStatusData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [successMsg, setSuccessMsg] = useState('');

    // Setup modal state for un-enrolled / re-enrollment
    const [setupChallenge, setSetupChallenge] = useState(null);

    // Modal states
    const [showRegenModal, setShowRegenModal] = useState(false);
    const [regenTotpCode, setRegenTotpCode] = useState('');
    const [newRecoveryCodes, setNewRecoveryCodes] = useState([]);
    const [copiedAllCodes, setCopiedAllCodes] = useState(false);
    const [actionLoading, setActionLoading] = useState(false);

    const [showDisableModal, setShowDisableModal] = useState(false);
    const [disableTotpCode, setDisableTotpCode] = useState('');
    const [disablePassword, setDisablePassword] = useState('');

    const fetchStatus = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const token = getAccessToken();
            const res = await fetch(`${API_BASE_URL}/api/admin/2fa/status`, {
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { Authorization: `Bearer ${token}` } : {})
                }
            });
            const data = await res.json();
            if (data.success) {
                setStatusData(data.data);
            } else {
                setError(data.message || 'Failed to load 2FA status.');
            }
        } catch (err) {
            setError(err.message || 'Network error fetching 2FA status.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchStatus();
    }, [fetchStatus]);

    // Handle Initiate 2FA Setup
    const handleInitiateSetup = async () => {
        setActionLoading(true);
        setError('');
        try {
            const token = getAccessToken();
            const res = await fetch(`${API_BASE_URL}/api/admin/2fa/setup`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { Authorization: `Bearer ${token}` } : {})
                }
            });
            const data = await res.json();
            if (data.success && data.data) {
                setSetupChallenge(data.data);
            } else {
                setError(data.message || 'Failed to initiate 2FA setup.');
            }
        } catch (err) {
            setError(err.message || 'Error communicating with server.');
        } finally {
            setActionLoading(false);
        }
    };

    const handleSetupSuccess = () => {
        setSetupChallenge(null);
        setSuccessMsg('Two-step verification has been enabled successfully.');
        fetchStatus();
    };

    // Handle Regenerate Recovery Codes
    const handleRegenerateCodes = async (e) => {
        e.preventDefault();
        const cleanCode = regenTotpCode.trim();
        if (!/^\d{6}$/.test(cleanCode)) {
            setError('Please enter your valid 6-digit authenticator code.');
            return;
        }

        setActionLoading(true);
        setError('');
        try {
            const token = getAccessToken();
            const res = await fetch(`${API_BASE_URL}/api/admin/2fa/regenerate-recovery-codes`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { Authorization: `Bearer ${token}` } : {})
                },
                body: JSON.stringify({ currentTotp: cleanCode })
            });
            const data = await res.json();
            const codes = data?.data?.recoveryCodes || data?.recoveryCodes;
            if (data.success && Array.isArray(codes)) {
                setNewRecoveryCodes(codes);
                setRegenTotpCode('');
                setSuccessMsg('Recovery codes regenerated successfully.');
                fetchStatus();
            } else {
                setError(data.message || 'Failed to regenerate recovery codes.');
            }
        } catch (err) {
            setError(err.message || 'Error communicating with server.');
        } finally {
            setActionLoading(false);
        }
    };

    // Handle Disable 2FA
    const handleDisable2FA = async (e) => {
        e.preventDefault();
        const cleanCode = disableTotpCode.trim();
        if (!/^\d{6}$/.test(cleanCode) || !disablePassword) {
            setError('Please provide both your password and current 6-digit TOTP code.');
            return;
        }

        setActionLoading(true);
        setError('');
        try {
            const token = getAccessToken();
            const res = await fetch(`${API_BASE_URL}/api/admin/2fa/disable`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { Authorization: `Bearer ${token}` } : {})
                },
                body: JSON.stringify({ currentTotp: cleanCode, password: disablePassword })
            });
            const data = await res.json();
            if (data.success) {
                setShowDisableModal(false);
                setDisableTotpCode('');
                setDisablePassword('');
                setSuccessMsg('Two-step verification has been disabled.');
                fetchStatus();
            } else {
                setError(data.message || 'Failed to disable 2FA.');
            }
        } catch (err) {
            setError(err.message || 'Error communicating with server.');
        } finally {
            setActionLoading(false);
        }
    };

    const handleCopyAllNewCodes = () => {
        if (!newRecoveryCodes.length) return;
        navigator.clipboard.writeText(newRecoveryCodes.join('\n'));
        setCopiedAllCodes(true);
        setTimeout(() => setCopiedAllCodes(false), 2000);
    };

    return (
        <div style={{
            background: 'rgba(15, 23, 42, 0.75)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            borderRadius: '16px',
            padding: '1.5rem',
            marginBottom: '1.5rem',
            backdropFilter: 'blur(10px)',
            color: '#fff'
        }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{
                        width: '42px',
                        height: '42px',
                        borderRadius: '10px',
                        background: 'linear-gradient(135deg, #0284c7, #0369a1)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '1.3rem',
                        color: '#fff'
                    }}>
                        <FaShieldAlt />
                    </div>
                    <div>
                        <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700 }}>
                            Admin Two-Step Verification (2FA)
                        </h3>
                        <p style={{ margin: '0.2rem 0 0', color: 'rgba(255,255,255,0.7)', fontSize: '0.85rem' }}>
                            RFC 6238-compatible Time-based One-Time Password (TOTP) protection for administrator accounts.
                        </p>
                    </div>
                </div>

                <button
                    type="button"
                    onClick={fetchStatus}
                    style={{
                        background: 'rgba(255, 255, 255, 0.08)',
                        border: '1px solid rgba(255, 255, 255, 0.15)',
                        color: '#fff',
                        padding: '0.45rem 0.9rem',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.4rem',
                        fontSize: '0.82rem'
                    }}
                >
                    <FaSync /> Refresh
                </button>
            </div>

            {/* Alert messages */}
            {error && (
                <div style={{
                    padding: '0.75rem 1rem',
                    marginBottom: '1rem',
                    borderRadius: '8px',
                    backgroundColor: 'rgba(239, 68, 68, 0.15)',
                    border: '1px solid rgba(239, 68, 68, 0.4)',
                    color: '#f87171',
                    fontSize: '0.88rem'
                }}>
                    {error}
                </div>
            )}

            {successMsg && (
                <div style={{
                    padding: '0.75rem 1rem',
                    marginBottom: '1rem',
                    borderRadius: '8px',
                    backgroundColor: 'rgba(16, 185, 129, 0.15)',
                    border: '1px solid rgba(16, 185, 129, 0.4)',
                    color: '#34d399',
                    fontSize: '0.88rem'
                }}>
                    {successMsg}
                </div>
            )}

            {loading ? (
                <div style={{ color: 'rgba(255,255,255,0.6)', padding: '1rem 0' }}>Loading 2FA configuration status...</div>
            ) : (
                <>
                    {/* Status overview cards */}
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                        gap: '1rem',
                        marginBottom: '1.25rem'
                    }}>
                        <div style={{
                            background: 'rgba(255, 255, 255, 0.04)',
                            border: '1px solid rgba(255, 255, 255, 0.08)',
                            borderRadius: '10px',
                            padding: '1rem'
                        }}>
                            <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'rgba(255,255,255,0.5)', marginBottom: '0.25rem' }}>
                                2FA Status
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <span style={{
                                    display: 'inline-block',
                                    width: '10px',
                                    height: '10px',
                                    borderRadius: '50%',
                                    backgroundColor: statusData?.enabled ? '#10b981' : '#f59e0b',
                                    boxShadow: statusData?.enabled ? '0 0 10px #10b981' : 'none'
                                }} />
                                <strong style={{ fontSize: '1.25rem', color: statusData?.enabled ? '#34d399' : '#fbbf24' }}>
                                    {statusData?.enabled ? 'Enabled' : 'Disabled'}
                                </strong>
                            </div>
                            <div style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.5)', marginTop: '0.35rem' }}>
                                {statusData?.enabled ? 'Google Authenticator linked' : '2FA setup required at next login'}
                            </div>
                        </div>

                        <div style={{
                            background: 'rgba(255, 255, 255, 0.04)',
                            border: '1px solid rgba(255, 255, 255, 0.08)',
                            borderRadius: '10px',
                            padding: '1rem'
                        }}>
                            <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'rgba(255,255,255,0.5)', marginBottom: '0.25rem' }}>
                                Backup Recovery Codes
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <FaKey style={{ color: '#0284c7' }} />
                                <strong style={{ fontSize: '1.25rem', color: '#38bdf8' }}>
                                    {statusData?.remainingRecoveryCodes ?? 0}
                                </strong>
                                <span style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.7)' }}>unused remaining</span>
                            </div>
                            <div style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.5)', marginTop: '0.35rem' }}>
                                Single-use emergency bypass codes
                            </div>
                        </div>

                        <div style={{
                            background: 'rgba(255, 255, 255, 0.04)',
                            border: '1px solid rgba(255, 255, 255, 0.08)',
                            borderRadius: '10px',
                            padding: '1rem'
                        }}>
                            <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'rgba(255,255,255,0.5)', marginBottom: '0.25rem' }}>
                                Security Method
                            </div>
                            <div style={{ fontSize: '1.1rem', fontWeight: 600, color: '#e2e8f0', marginTop: '0.2rem' }}>
                                RFC 6238 TOTP
                            </div>
                            <div style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.5)', marginTop: '0.35rem' }}>
                                30-sec step | ±1 skew | Replay protected
                            </div>
                        </div>
                    </div>

                    {/* Actions bar */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center' }}>
                        {statusData?.enabled ? (
                            <>
                                <button
                                    type="button"
                                    onClick={() => { setShowRegenModal(true); setNewRecoveryCodes([]); setError(''); }}
                                    style={{
                                        background: 'rgba(2, 132, 199, 0.15)',
                                        border: '1px solid rgba(2, 132, 199, 0.4)',
                                        color: '#38bdf8',
                                        padding: '0.6rem 1.1rem',
                                        borderRadius: '8px',
                                        cursor: 'pointer',
                                        fontWeight: 600,
                                        fontSize: '0.88rem',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.5rem'
                                    }}
                                >
                                    <FaKey /> Regenerate Recovery Codes
                                </button>

                                <button
                                    type="button"
                                    onClick={() => { setShowDisableModal(true); setError(''); }}
                                    style={{
                                        background: 'rgba(239, 68, 68, 0.12)',
                                        border: '1px solid rgba(239, 68, 68, 0.3)',
                                        color: '#f87171',
                                        padding: '0.6rem 1.1rem',
                                        borderRadius: '8px',
                                        cursor: 'pointer',
                                        fontWeight: 600,
                                        fontSize: '0.88rem',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.5rem'
                                    }}
                                >
                                    <FaTrashAlt /> Disable 2FA
                                </button>
                            </>
                        ) : (
                            <button
                                type="button"
                                onClick={handleInitiateSetup}
                                disabled={actionLoading}
                                style={{
                                    background: 'linear-gradient(135deg, #0284c7, #0369a1)',
                                    border: 'none',
                                    color: '#fff',
                                    padding: '0.7rem 1.3rem',
                                    borderRadius: '8px',
                                    cursor: actionLoading ? 'not-allowed' : 'pointer',
                                    fontWeight: 700,
                                    fontSize: '0.9rem',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.5rem',
                                    boxShadow: '0 4px 12px rgba(2, 132, 199, 0.3)'
                                }}
                            >
                                <FaShieldAlt /> {actionLoading ? 'Initializing...' : 'Set Up Google Authenticator'}
                            </button>
                        )}
                    </div>
                </>
            )}

            {/* Modal: Set Up 2FA */}
            {setupChallenge && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: 'rgba(0, 0, 0, 0.75)',
                    backdropFilter: 'blur(4px)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 1000,
                    padding: '1rem'
                }}>
                    <div style={{ maxWidth: '480px', width: '100%' }}>
                        <TwoFactorAuthFlow
                            challengeData={setupChallenge}
                            onSuccess={handleSetupSuccess}
                            onCancel={() => setSetupChallenge(null)}
                        />
                    </div>
                </div>
            )}

            {/* Modal: Regenerate Recovery Codes */}
            {showRegenModal && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: 'rgba(0, 0, 0, 0.75)',
                    backdropFilter: 'blur(4px)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 1000,
                    padding: '1rem'
                }}>
                    <div style={{
                        background: '#0f172a',
                        border: '1px solid rgba(255, 255, 255, 0.15)',
                        borderRadius: '16px',
                        maxWidth: '500px',
                        width: '100%',
                        padding: '1.75rem',
                        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                            <h3 style={{ margin: 0, fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <FaKey style={{ color: '#0284c7' }} /> Regenerate Recovery Codes
                            </h3>
                            <button
                                type="button"
                                onClick={() => { setShowRegenModal(false); setNewRecoveryCodes([]); }}
                                style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.6)', cursor: 'pointer', fontSize: '1.1rem' }}
                            >
                                <FaTimes />
                            </button>
                        </div>

                        {newRecoveryCodes.length === 0 ? (
                            <form onSubmit={handleRegenerateCodes}>
                                <div style={{
                                    padding: '0.75rem 1rem',
                                    borderRadius: '8px',
                                    backgroundColor: 'rgba(245, 158, 11, 0.12)',
                                    border: '1px solid rgba(245, 158, 11, 0.3)',
                                    color: '#fbbf24',
                                    fontSize: '0.85rem',
                                    marginBottom: '1rem',
                                    display: 'flex',
                                    gap: '0.5rem',
                                    alignItems: 'flex-start'
                                }}>
                                    <FaExclamationTriangle style={{ marginTop: '2px', flexShrink: 0 }} />
                                    <span>
                                        Regenerating recovery codes will immediately invalidate all previously issued recovery codes.
                                        Re-authenticate using your 6-digit Google Authenticator code to proceed.
                                    </span>
                                </div>

                                <div style={{ marginBottom: '1.25rem' }}>
                                    <label htmlFor="regenTotp" style={{ display: 'block', fontSize: '0.88rem', fontWeight: 600, marginBottom: '0.4rem' }}>
                                        Current 6-Digit Authenticator Code
                                    </label>
                                    <input
                                        id="regenTotp"
                                        type="text"
                                        maxLength={6}
                                        value={regenTotpCode}
                                        onChange={(e) => setRegenTotpCode(e.target.value.replace(/\D/g, ''))}
                                        placeholder="000000"
                                        style={{
                                            width: '100%',
                                            padding: '0.75rem',
                                            borderRadius: '8px',
                                            background: 'rgba(255,255,255,0.06)',
                                            border: '1px solid rgba(255,255,255,0.2)',
                                            color: '#fff',
                                            fontSize: '1.2rem',
                                            letterSpacing: '4px',
                                            textAlign: 'center'
                                        }}
                                        required
                                        autoFocus
                                    />
                                </div>

                                <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                                    <button
                                        type="button"
                                        onClick={() => setShowRegenModal(false)}
                                        style={{
                                            background: 'rgba(255,255,255,0.1)',
                                            border: 'none',
                                            color: '#fff',
                                            padding: '0.65rem 1.25rem',
                                            borderRadius: '8px',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={actionLoading || regenTotpCode.length !== 6}
                                        style={{
                                            background: '#0284c7',
                                            border: 'none',
                                            color: '#fff',
                                            padding: '0.65rem 1.25rem',
                                            borderRadius: '8px',
                                            cursor: actionLoading ? 'not-allowed' : 'pointer',
                                            fontWeight: 700
                                        }}
                                    >
                                        {actionLoading ? 'Regenerating...' : 'Regenerate Codes'}
                                    </button>
                                </div>
                            </form>
                        ) : (
                            <div>
                                <p style={{ fontSize: '0.9rem', color: 'rgba(255,255,255,0.8)', marginBottom: '1rem' }}>
                                    Here are your 10 new emergency backup codes. Store them in a secure password manager.
                                    They will not be shown again.
                                </p>

                                <div style={{
                                    display: 'grid',
                                    gridTemplateColumns: 'repeat(2, 1fr)',
                                    gap: '0.5rem',
                                    background: 'rgba(0,0,0,0.3)',
                                    padding: '1rem',
                                    borderRadius: '8px',
                                    marginBottom: '1rem'
                                }}>
                                    {newRecoveryCodes.map((code, idx) => (
                                        <div key={idx} style={{
                                            fontFamily: 'monospace',
                                            fontSize: '0.95rem',
                                            letterSpacing: '1px',
                                            color: '#38bdf8',
                                            textAlign: 'center',
                                            padding: '0.35rem',
                                            background: 'rgba(255,255,255,0.03)',
                                            borderRadius: '4px'
                                        }}>
                                            {code}
                                        </div>
                                    ))}
                                </div>

                                <div style={{ display: 'flex', gap: '0.75rem' }}>
                                    <button
                                        type="button"
                                        onClick={handleCopyAllNewCodes}
                                        style={{
                                            flex: 1,
                                            background: 'rgba(255,255,255,0.1)',
                                            border: '1px solid rgba(255,255,255,0.2)',
                                            color: '#fff',
                                            padding: '0.65rem',
                                            borderRadius: '8px',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            gap: '0.5rem'
                                        }}
                                    >
                                        {copiedAllCodes ? <FaCheck style={{ color: '#10b981' }} /> : <FaCopy />}
                                        {copiedAllCodes ? 'Copied to Clipboard' : 'Copy All Codes'}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setShowRegenModal(false)}
                                        style={{
                                            background: '#10b981',
                                            border: 'none',
                                            color: '#fff',
                                            padding: '0.65rem 1.25rem',
                                            borderRadius: '8px',
                                            cursor: 'pointer',
                                            fontWeight: 700
                                        }}
                                    >
                                        Done
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Modal: Disable 2FA */}
            {showDisableModal && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: 'rgba(0, 0, 0, 0.75)',
                    backdropFilter: 'blur(4px)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 1000,
                    padding: '1rem'
                }}>
                    <div style={{
                        background: '#0f172a',
                        border: '1px solid rgba(239, 68, 68, 0.3)',
                        borderRadius: '16px',
                        maxWidth: '480px',
                        width: '100%',
                        padding: '1.75rem',
                        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                            <h3 style={{ margin: 0, fontSize: '1.25rem', color: '#f87171', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <FaExclamationTriangle /> Disable Two-Step Verification
                            </h3>
                            <button
                                type="button"
                                onClick={() => setShowDisableModal(false)}
                                style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.6)', cursor: 'pointer', fontSize: '1.1rem' }}
                            >
                                <FaTimes />
                            </button>
                        </div>

                        <p style={{ fontSize: '0.88rem', color: 'rgba(255,255,255,0.7)', marginBottom: '1.25rem' }}>
                            Disabling 2FA lowers the security of your administrator account.
                            To confirm this sensitive change, you must re-authenticate with both your password and your current authenticator code.
                        </p>

                        <form onSubmit={handleDisable2FA}>
                            <div style={{ marginBottom: '1rem' }}>
                                <label htmlFor="disablePassword" style={{ display: 'block', fontSize: '0.88rem', fontWeight: 600, marginBottom: '0.4rem' }}>
                                    Admin Password
                                </label>
                                <input
                                    id="disablePassword"
                                    type="password"
                                    value={disablePassword}
                                    onChange={(e) => setDisablePassword(e.target.value)}
                                    placeholder="Enter your password"
                                    style={{
                                        width: '100%',
                                        padding: '0.75rem',
                                        borderRadius: '8px',
                                        background: 'rgba(255,255,255,0.06)',
                                        border: '1px solid rgba(255,255,255,0.2)',
                                        color: '#fff'
                                    }}
                                    required
                                    autoFocus
                                />
                            </div>

                            <div style={{ marginBottom: '1.25rem' }}>
                                <label htmlFor="disableTotp" style={{ display: 'block', fontSize: '0.88rem', fontWeight: 600, marginBottom: '0.4rem' }}>
                                    Current 6-Digit Authenticator Code
                                </label>
                                <input
                                    id="disableTotp"
                                    type="text"
                                    maxLength={6}
                                    value={disableTotpCode}
                                    onChange={(e) => setDisableTotpCode(e.target.value.replace(/\D/g, ''))}
                                    placeholder="000000"
                                    style={{
                                        width: '100%',
                                        padding: '0.75rem',
                                        borderRadius: '8px',
                                        background: 'rgba(255,255,255,0.06)',
                                        border: '1px solid rgba(255,255,255,0.2)',
                                        color: '#fff',
                                        fontSize: '1.2rem',
                                        letterSpacing: '4px',
                                        textAlign: 'center'
                                    }}
                                    required
                                />
                            </div>

                            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                                <button
                                    type="button"
                                    onClick={() => setShowDisableModal(false)}
                                    style={{
                                        background: 'rgba(255,255,255,0.1)',
                                        border: 'none',
                                        color: '#fff',
                                        padding: '0.65rem 1.25rem',
                                        borderRadius: '8px',
                                        cursor: 'pointer'
                                    }}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={actionLoading || disableTotpCode.length !== 6 || !disablePassword}
                                    style={{
                                        background: '#dc2626',
                                        border: 'none',
                                        color: '#fff',
                                        padding: '0.65rem 1.25rem',
                                        borderRadius: '8px',
                                        cursor: actionLoading ? 'not-allowed' : 'pointer',
                                        fontWeight: 700
                                    }}
                                >
                                    {actionLoading ? 'Disabling...' : 'Disable 2FA'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminTwoFactorSettings;
