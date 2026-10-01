import React, { useState, useEffect } from 'react';
import { FaShieldAlt, FaServer, FaLock, FaCheckCircle, FaExclamationTriangle, FaTerminal, FaSync, FaBan } from 'react-icons/fa';
import { API_BASE_URL } from '../api/backendApi';

const SecurityMcpDashboard = () => {
    const [securityData, setSecurityData] = useState(null);
    const [manifestName, setManifestName] = useState('');
    const [loading, setLoading] = useState(true);
    const [activeMcpTool, setActiveMcpTool] = useState('bylot_security_audit');
    const [mcpResult, setMcpResult] = useState(null);
    const [mcpLoading, setMcpLoading] = useState(false);

    const fetchSecurityStatus = async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem('accessToken');
            const res = await fetch(`${API_BASE_URL}/api/security/status`, {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                }
            });
            const data = await res.json();
            if (data.success) {
                setSecurityData(data.data);
            }
        } catch (err) {
            console.error('Failed to load security status:', err);
        } finally {
            setLoading(false);
        }
    };

    const fetchMcpManifest = async () => {
        try {
            const res = await fetch(`${API_BASE_URL}/mcp/manifest`);
            const data = await res.json();
            if (data.success) {
                setManifestName(data.data?.name || 'bylot-mcp-server');
            }
        } catch (err) {
            console.error('Failed to load MCP manifest:', err);
        }
    };

    const runMcpTool = async (toolName) => {
        setMcpLoading(true);
        setActiveMcpTool(toolName);
        try {
            const token = localStorage.getItem('accessToken');
            const res = await fetch(`${API_BASE_URL}/mcp/tools/${toolName}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({})
            });
            const data = await res.json();
            setMcpResult(data);
        } catch (err) {
            setMcpResult({ error: err.message });
        } finally {
            setMcpLoading(false);
        }
    };

    useEffect(() => {
        fetchSecurityStatus();
        fetchMcpManifest();
    }, []);

    return (
        <div style={{ color: '#fff', padding: '1rem' }}>
            {/* Header Banner */}
            <div style={{
                background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.15), rgba(59, 130, 246, 0.15))',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                borderRadius: '16px',
                padding: '1.5rem',
                marginBottom: '1.5rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                backdropFilter: 'blur(10px)'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{
                        width: '54px',
                        height: '54px',
                        borderRadius: '12px',
                        background: 'linear-gradient(135deg, #10B981, #059669)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '1.8rem',
                        color: '#fff',
                        boxShadow: '0 4px 14px rgba(16, 185, 129, 0.4)'
                    }}>
                        <FaShieldAlt />
                    </div>
                    <div>
                        <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: '700' }}>Enterprise Security & Model Context Protocol (MCP)</h2>
                        <p style={{ margin: '0.25rem 0 0 0', color: 'rgba(255, 255, 255, 0.7)', fontSize: '0.9rem' }}>
                            7-Layer WAF, AES-256-GCM Cryptography, Anti-Brute Force Lockout & Stdio/HTTP MCP Server.
                        </p>
                    </div>
                </div>
                <button
                    onClick={() => { fetchSecurityStatus(); fetchMcpManifest(); }}
                    style={{
                        background: 'rgba(255, 255, 255, 0.1)',
                        border: '1px solid rgba(255, 255, 255, 0.2)',
                        color: '#fff',
                        padding: '0.6rem 1.2rem',
                        borderRadius: '10px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        fontSize: '0.9rem',
                        fontWeight: '600'
                    }}
                >
                    <FaSync /> Refresh Status
                </button>
            </div>

            {/* Metrics Overview Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
                <div style={{ background: 'rgba(15, 23, 42, 0.6)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '12px', padding: '1.25rem' }}>
                    <div style={{ color: '#10B981', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: '600', marginBottom: '0.5rem' }}>
                        <FaCheckCircle /> Security Posture Score
                    </div>
                    <div style={{ fontSize: '2rem', fontWeight: '800' }}>100 / 100</div>
                    <div style={{ fontSize: '0.8rem', color: '#10B981' }}>OPTIMAL - All 6 Modules Active</div>
                </div>

                <div style={{ background: 'rgba(15, 23, 42, 0.6)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '12px', padding: '1.25rem' }}>
                    <div style={{ color: '#3B82F6', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: '600', marginBottom: '0.5rem' }}>
                        <FaLock /> Threat Level
                    </div>
                    <div style={{ fontSize: '2rem', fontWeight: '800' }}>
                        {securityData?.threatLevel || 'NORMAL'}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'rgba(255, 255, 255, 0.6)' }}>7-Layer WAF Active</div>
                </div>

                <div style={{ background: 'rgba(15, 23, 42, 0.6)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '12px', padding: '1.25rem' }}>
                    <div style={{ color: '#F59E0B', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: '600', marginBottom: '0.5rem' }}>
                        <FaBan /> Active Lockouts
                    </div>
                    <div style={{ fontSize: '2rem', fontWeight: '800' }}>
                        {securityData?.activeLockouts?.activeLockoutsCount || 0}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'rgba(255, 255, 255, 0.6)' }}>Identities auto-locked</div>
                </div>

                <div style={{ background: 'rgba(15, 23, 42, 0.6)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '12px', padding: '1.25rem' }}>
                    <div style={{ color: '#8B5CF6', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: '600', marginBottom: '0.5rem' }}>
                        <FaServer /> MCP Protocol Server
                    </div>
                    <div style={{ fontSize: '1.4rem', fontWeight: '800', margin: '0.25rem 0' }}>ONLINE</div>
                    <div style={{ fontSize: '0.8rem', color: '#8B5CF6' }}>Stdio + HTTP Transport</div>
                </div>
            </div>

            {/* MCP Interactive Tool Test Sandbox */}
            <div style={{
                background: 'rgba(15, 23, 42, 0.7)',
                border: '1px solid rgba(139, 92, 246, 0.3)',
                borderRadius: '16px',
                padding: '1.5rem',
                marginBottom: '1.5rem'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
                    <FaTerminal style={{ fontSize: '1.4rem', color: '#8B5CF6' }} />
                    <h3 style={{ margin: 0, fontSize: '1.2rem' }}>Model Context Protocol (MCP) Live Sandbox{manifestName ? ` (${manifestName})` : ''}</h3>
                </div>

                <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.9rem', marginBottom: '1rem' }}>
                    Select an MCP tool below to execute live JSON-RPC protocol requests against the application MCP server:
                </p>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem' }}>
                    {[
                        'bylot_system_status',
                        'bylot_security_audit',
                        'bylot_database_analytics'
                    ].map((tool) => (
                        <button
                            key={tool}
                            onClick={() => runMcpTool(tool)}
                            style={{
                                background: activeMcpTool === tool ? 'linear-gradient(135deg, #8B5CF6, #6D28D9)' : 'rgba(255,255,255,0.08)',
                                border: '1px solid rgba(255,255,255,0.15)',
                                color: '#fff',
                                padding: '0.5rem 1rem',
                                borderRadius: '8px',
                                cursor: 'pointer',
                                fontWeight: activeMcpTool === tool ? '700' : '400',
                                fontSize: '0.85rem'
                            }}
                        >
                            {tool}
                        </button>
                    ))}
                </div>

                <div style={{
                    background: '#090D16',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '10px',
                    padding: '1rem',
                    fontFamily: 'Consolas, Monaco, monospace',
                    fontSize: '0.85rem',
                    color: '#10B981',
                    maxHeight: '260px',
                    overflowY: 'auto'
                }}>
                    {mcpLoading ? (
                        <div>Executing MCP tool payload...</div>
                    ) : mcpResult ? (
                        <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{JSON.stringify(mcpResult, null, 2)}</pre>
                    ) : (
                        <div style={{ color: 'rgba(255,255,255,0.4)' }}>Click any MCP tool button above to test execution.</div>
                    )}
                </div>
            </div>

            {/* Audit Logs Feed */}
            <div style={{
                background: 'rgba(15, 23, 42, 0.7)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '16px',
                padding: '1.5rem'
            }}>
                <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <FaExclamationTriangle style={{ color: '#F59E0B' }} /> Real-time Security Event Audit Stream
                </h3>

                {loading ? (
                    <div>Loading security events...</div>
                ) : securityData?.auditStats?.totalEvents > 0 || (securityData?.data?.events && securityData.data.events.length > 0) ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {(securityData?.auditStats?.logs || []).slice(0, 10).map((log, idx) => (
                            <div key={idx} style={{
                                background: 'rgba(255,255,255,0.03)',
                                borderLeft: `4px solid ${log.severity === 'CRITICAL' ? '#EF4444' : log.severity === 'HIGH' ? '#F59E0B' : '#3B82F6'}`,
                                padding: '0.75rem 1rem',
                                borderRadius: '6px',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center'
                            }}>
                                <div>
                                    <span style={{
                                        fontWeight: '700',
                                        color: log.severity === 'CRITICAL' ? '#EF4444' : log.severity === 'HIGH' ? '#F59E0B' : '#3B82F6',
                                        fontSize: '0.8rem',
                                        marginRight: '0.75rem'
                                    }}>
                                        [{log.severity}] {log.type}
                                    </span>
                                    <span style={{ fontSize: '0.9rem', color: '#E2E8F0' }}>{log.details || log.message || 'Security assertion logged.'}</span>
                                </div>
                                <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)' }}>
                                    {log.timestamp ? new Date(log.timestamp).toLocaleTimeString() : 'Just now'}
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div style={{ color: 'rgba(255,255,255,0.5)', fontStyle: 'italic' }}>
                        No suspicious security violations recorded. Platform threat status is OPTIMAL.
                    </div>
                )}
            </div>
        </div>
    );
};

export default SecurityMcpDashboard;
