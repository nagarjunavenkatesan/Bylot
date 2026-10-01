import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

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

function getInitialLocationState() {
    try {
        const savedStatus = localStorage.getItem('bylot_location_status');
        const savedCoords = localStorage.getItem('bylot_coords');
        const savedCity   = localStorage.getItem('bylot_manual_city');

        if (savedStatus === 'granted' && savedCoords) {
            return {
                coords: JSON.parse(savedCoords),
                status: 'granted',
                cityName: 'GPS Location',
                loading: false
            };
        }

        if (savedStatus === 'manual' && savedCoords && savedCity) {
            return {
                coords: JSON.parse(savedCoords),
                status: 'manual',
                cityName: savedCity,
                loading: false
            };
        }

        if (savedStatus === 'denied') {
            return {
                coords: null,
                status: 'denied',
                cityName: '',
                loading: false
            };
        }
    } catch {
        // Fall back to prompt
    }

    return {
        coords: null,
        status: 'prompt',
        cityName: '',
        loading: false
    };
}

export const LocationProvider = ({ children }) => {
    const [locationState, setLocationState] = useState(getInitialLocationState);

    const requestLocation = useCallback(() => {
        setLocationState((prev) => ({ ...prev, loading: true }));

        if (!navigator.geolocation) {
            setLocationState({
                coords: null,
                status: 'denied',
                cityName: '',
                loading: false
            });
            return;
        }

        navigator.geolocation.getCurrentPosition(
            (position) => {
                const newCoords = {
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude
                };
                setLocationState({
                    coords: newCoords,
                    status: 'granted',
                    cityName: 'GPS Location',
                    loading: false
                });
                localStorage.setItem('bylot_location_status', 'granted');
                localStorage.setItem('bylot_coords', JSON.stringify(newCoords));
                localStorage.removeItem('bylot_manual_city');
            },
            () => {
                setLocationState({
                    coords: null,
                    status: 'denied',
                    cityName: '',
                    loading: false
                });
                localStorage.setItem('bylot_location_status', 'denied');
            },
            { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 }
        );
    }, []);

    const setManualLocation = useCallback((city) => {
        const newCoords = { latitude: city.latitude, longitude: city.longitude };
        setLocationState({
            coords: newCoords,
            status: 'manual',
            cityName: city.name,
            loading: false
        });
        localStorage.setItem('bylot_location_status', 'manual');
        localStorage.setItem('bylot_coords', JSON.stringify(newCoords));
        localStorage.setItem('bylot_manual_city', city.name);
    }, []);

    useEffect(() => {
        const savedStatus = localStorage.getItem('bylot_location_status');
        if (!savedStatus && typeof navigator !== 'undefined' && navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const newCoords = {
                        latitude: position.coords.latitude,
                        longitude: position.coords.longitude
                    };
                    setLocationState({
                        coords: newCoords,
                        status: 'granted',
                        cityName: 'GPS Location',
                        loading: false
                    });
                    localStorage.setItem('bylot_location_status', 'granted');
                    localStorage.setItem('bylot_coords', JSON.stringify(newCoords));
                    localStorage.removeItem('bylot_manual_city');
                },
                () => {
                    setLocationState({
                        coords: null,
                        status: 'denied',
                        cityName: '',
                        loading: false
                    });
                    localStorage.setItem('bylot_location_status', 'denied');
                },
                { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 }
            );
        }
    }, []);

    return (
        <LocationContext.Provider value={{
            coords: locationState.coords,
            status: locationState.status,
            loading: locationState.loading,
            cityName: locationState.cityName,
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
