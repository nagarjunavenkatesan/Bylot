import React, { createContext, useContext, useState, useEffect } from 'react';
import { setAccessToken, silentRefresh, apiRequest } from '../api/backendApi';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let isMounted = true;

        async function initAuth() {
            try {
                const refreshedUser = await silentRefresh();
                if (isMounted && refreshedUser) {
                    setUser(refreshedUser);
                }
            } catch {
                if (isMounted) {
                    setUser(null);
                }
            } finally {
                if (isMounted) {
                    setLoading(false);
                }
            }
        }

        initAuth();

        const handleAuthExpired = () => {
            if (isMounted) {
                setAccessToken(null);
                setUser(null);
            }
        };

        window.addEventListener('auth:expired', handleAuthExpired);

        return () => {
            isMounted = false;
            window.removeEventListener('auth:expired', handleAuthExpired);
        };
    }, []);

    const login = (authData) => {
        const token = authData.accessToken || authData.token;
        if (token) {
            setAccessToken(token);
        }
        const userObj = authData.user || authData;
        setUser(userObj);
    };

    const logout = async () => {
        try {
            await apiRequest('/api/auth/logout', { method: 'POST' });
        } catch {
            // ignore network or logout errors
        } finally {
            setAccessToken(null);
            setUser(null);
        }
    };

    return (
        <AuthContext.Provider value={{ user, login, logout, loading }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    return useContext(AuthContext);
};
