import React, { StrictMode, Component } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { AuthProvider } from './context/AuthContext';
import GoogleProvider from './components/GoogleProvider';

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, info) {
    console.error('ErrorBoundary caught:', error, info);
  }
  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };
  handleHardReset = () => {
    localStorage.removeItem('bylot_coords');
    localStorage.removeItem('bylot_location_status');
    window.location.href = '/';
  };
  render() {
    if (this.state.hasError) {
      const isProd = import.meta.env.MODE === 'production';
      return (
        <div style={{ padding: '2rem', fontFamily: 'sans-serif', textAlign: 'center', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-main, #f8fafc)', color: 'var(--text-main, #0f172a)' }}>
          <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>🌱</div>
          <h1 style={{ fontSize: '2rem', marginBottom: '0.5rem', fontWeight: '800' }}>Bylot Recovered Gracefully</h1>
          <p style={{ color: '#64748b', marginBottom: '1.5rem', maxWidth: '500px' }}>A temporary error occurred. You can safely try again or return to the home screen.</p>
          {!isProd && (
            <pre style={{ background: 'rgba(0,0,0,0.05)', padding: '1rem', borderRadius: '12px', maxWidth: '600px', overflow: 'auto', fontSize: '0.85rem', color: '#ef4444', marginBottom: '1.5rem' }}>
              {this.state.error?.message || 'Unknown error'}
            </pre>
          )}
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', justifyContent: 'center' }}>
            <button onClick={this.handleReset} style={{ padding: '0.75rem 1.8rem', background: '#6366f1', color: '#fff', border: 'none', borderRadius: '999px', cursor: 'pointer', fontSize: '0.95rem', fontWeight: '700' }}>
              🔄 Try Again
            </button>
            <button onClick={this.handleHardReset} style={{ padding: '0.75rem 1.8rem', background: '#e2e8f0', color: '#334155', border: 'none', borderRadius: '999px', cursor: 'pointer', fontSize: '0.95rem', fontWeight: '700' }}>
              🏠 Return to Home
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <AuthProvider>
        <GoogleProvider>
          <App />
        </GoogleProvider>
      </AuthProvider>
    </ErrorBoundary>
  </StrictMode>,
);
