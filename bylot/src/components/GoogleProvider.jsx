import React, { useState, useEffect } from 'react';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { apiRequest } from '../api/backendApi';

const DEFAULT_CLIENT_ID = '358858464400-6di0qk18deq2fejn7g3f830i2g5fr1nf.apps.googleusercontent.com';

export default function GoogleProvider({ children }) {
  const [clientId, setClientId] = useState(
    import.meta.env.VITE_GOOGLE_CLIENT_ID || DEFAULT_CLIENT_ID
  );
  const [ready, setReady] = useState(false);

  useEffect(() => {
    apiRequest('/api/config')
      .then(res => {
        const id = res?.data?.googleClientId;
        if (id && id !== 'your_google_oauth_client_id.apps.googleusercontent.com') {
          setClientId(id);
        }
      })
      .catch(() => {})
      .finally(() => setReady(true));
  }, []);

  if (!ready) return null;

  const effectiveId = clientId || import.meta.env.VITE_GOOGLE_CLIENT_ID || DEFAULT_CLIENT_ID;

  return (
    <GoogleOAuthProvider clientId={effectiveId}>
      {children}
    </GoogleOAuthProvider>
  );
}
