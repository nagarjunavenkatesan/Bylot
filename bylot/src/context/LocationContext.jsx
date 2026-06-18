import React, { createContext, useContext, useState, useEffect } from 'react';

const LocationContext = createContext(null);

export const PRESET_CITIES = [
    { name: 'Bangalore', latitude: 12.9716, longitude: 77.5946 },
    { name: 'Mumbai',    latitude: 19.0760, longitude: 72.8777 },
    { name: 'Delhi',     latitude: 28.6139, longitude: 77.2090 },
    { name: 'Chennai',   latitude: 13.0827, longitude: 80.2707 },
    { name: 'Kolkata',   latitude: 22.5726, longitude: 88.3639 },
    { name: 'Hyderabad', latitude: 17.3850, longitude: 78.4867 },
    { name: 'Pune',      latitude: 18.5204, longitude: 73.8567 }
];

export const LocationProvider = ({ children }) => {
    const [coords, setCoords]     = useState(null);
    const [status, setStatus]     = useState('prompt'); // 'prompt' | 'granted' | 'denied' | 'manual'
    const [loading, setLoading]   = useState(true);
    const [cityName, setCityName] = useState('');

    const requestLocation = () => {
        setLoading(true);

        if (!navigator.geolocation) {
            // No geolocation support — just finish loading, don't block
            setStatus('denied');
            setLoading(false);
            return;
        }

        navigator.geolocation.getCurrentPosition(
            (position) => {
                const newCoords = {
                    latitude:  position.coords.latitude,
                    longitude: position.coords.longitude
                };
                setCoords(newCoords);
                setStatus('granted');
                setCityName('GPS Location');
                setLoading(false);
                localStorage.setItem('bylot_location_status', 'granted');
                localStorage.setItem('bylot_coords', JSON.stringify(newCoords));
                localStorage.removeItem('bylot_manual_city');
            },
            () => {
                // Denied or unavailable — silently fall back, NEVER block the page
                setStatus('denied');
                setLoading(false);
                localStorage.setItem('bylot_location_status', 'denied');
            },
            { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 }
        );
    };

    const setManualLocation = (city) => {
        const newCoords = { latitude: city.latitude, longitude: city.longitude };
        setCoords(newCoords);
        setStatus('manual');
        setCityName(city.name);
        setLoading(false);
        localStorage.setItem('bylot_location_status', 'manual');
        localStorage.setItem('bylot_coords', JSON.stringify(newCoords));
        localStorage.setItem('bylot_manual_city', city.name);
    };

    useEffect(() => {
        const savedStatus = localStorage.getItem('bylot_location_status');
        const savedCoords = localStorage.getItem('bylot_coords');
        const savedCity   = localStorage.getItem('bylot_manual_city');

        if (savedStatus === 'granted' && savedCoords) {
            try {
                setCoords(JSON.parse(savedCoords));
                setStatus('granted');
                setCityName('GPS Location');
                setLoading(false);
                return;
            } catch (_) { /* fall through */ }
        }

        if (savedStatus === 'manual' && savedCoords && savedCity) {
            try {
                setCoords(JSON.parse(savedCoords));
                setStatus('manual');
                setCityName(savedCity);
                setLoading(false);
                return;
            } catch (_) { /* fall through */ }
        }

        if (savedStatus === 'denied') {
            // Already denied before — don't ask again, just finish loading
            setStatus('denied');
            setLoading(false);
            return;
        }

        // First visit — try to get location silently
        requestLocation();
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    return (
        <LocationContext.Provider value={{
            coords,
            status,
            loading,
            cityName,
            requestLocation,
            setManualLocation
        }}>
            {children}
        </LocationContext.Provider>
    );
};

export const useLocation = () => {
    const context = useContext(LocationContext);
    if (!context) throw new Error('useLocation must be used within a LocationProvider');
    return context;
};
