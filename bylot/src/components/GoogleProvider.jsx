import React, { createContext, useContext, useState, useEffect } from 'react';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { apiRequest } from '../api/backendApi';

const DEFAULT_CLIENT_ID = '358858464400-6di0qk18deq2fejn7g3f830i2g5fr1nf.apps.googleusercontent.com';

function isValidClientId(id) {
  if (!id || typeof id !== 'string') return false;
  const trimmed = id.trim();
  if (trimmed === '' || trimmed === 'your_google_oauth_client_id.apps.googleusercontent.com') return false;
  return trimmed.endsWith('.apps.googleusercontent.com');
}

export const GoogleAuthContext = createContext({
  clientId: '',
  isConfigured: false,
});

export function useGoogleAuth() {
  return useContext(GoogleAuthContext);
}

export default function GoogleProvider({ children }) {
  const initialId = (import.meta.env.VITE_GOOGLE_CLIENT_ID || DEFAULT_CLIENT_ID || '').trim();
  const [clientId, setClientId] = useState(initialId);

  useEffect(() => {
    // Non-blocking background fetch of /api/config.
    // If backend is unavailable or offline, this never blocks the application.
    let mounted = true;
    apiRequest('/api/config')
      .then((res) => {
        if (!mounted) return;
        const remoteId = (res?.data?.googleClientId || res?.googleClientId || '').trim();
        if (isValidClientId(remoteId) && remoteId !== clientId) {
          setClientId(remoteId);
        }
      })
      .catch((_) => {
        // Silently continue; local or env-based client ID remains active
      });

    return () => {
      mounted = false;
    };
  }, [clientId]);

  const effectiveId = isValidClientId(clientId) ? clientId : (isValidClientId(initialId) ? initialId : '');
  const isConfigured = Boolean(effectiveId);

  const contextValue = {
    clientId: effectiveId,
    isConfigured,
  };

  const content = (
    <GoogleAuthContext.Provider value={contextValue}>
      {children}
    </GoogleAuthContext.Provider>
  );

  if (isConfigured) {
    return (
      <GoogleOAuthProvider clientId={effectiveId}>
        {content}
      </GoogleOAuthProvider>
    );
  }

  // If Google OAuth Client ID is not configured, render the entire React application
  // without blocking so users can still use normal email/password authentication.
  return content;
}
