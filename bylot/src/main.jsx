import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { GoogleOAuthProvider } from '@react-oauth/google';
import { AuthProvider } from './context/AuthContext';

async function bootstrap() {
  let clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

  if (!clientId || clientId === 'YOUR_GOOGLE_CLIENT_ID' || clientId.length < 5) {
    try {
      const res = await fetch('/api/config');
      const data = await res.json();
      clientId = data?.data?.googleClientId || data?.googleClientId || '';
    } catch (err) {
      console.warn('Could not fetch Google client ID from backend:', err.message);
    }
  }

  const app = (
    <AuthProvider>
      <App />
    </AuthProvider>
  );

  createRoot(document.getElementById('root')).render(
    <StrictMode>
      {clientId ? (
        <GoogleOAuthProvider clientId={clientId}>
          {app}
        </GoogleOAuthProvider>
      ) : (
        app
      )}
    </StrictMode>,
  );
}

bootstrap();
