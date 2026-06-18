// API_BASE_URL is used ONLY for resolving image URLs and external references.
// All fetch() calls use relative paths so the Vite dev proxy handles them
// in development, and the same-origin server handles them in production.
const DEFAULT_BACKEND_URL = 'http://localhost:5000';

export const API_BASE_URL = (
    import.meta.env.VITE_API_BASE_URL ||
    DEFAULT_BACKEND_URL
).replace(/\/$/, '');

const API_KEY = import.meta.env.VITE_BYLOT_API_KEY || '';

// ---------- core request helper ----------
// Always uses a RELATIVE path so the Vite proxy forwards it to the backend.
export async function apiRequest(path, options = {}) {
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;

    const headers = {
        Accept: 'application/json',
        'X-Bylot-Handshake': localStorage.getItem('bylot-handshake') || '',
        ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
        ...(API_KEY ? { 'x-api-key': API_KEY } : {}),
        ...options.headers,
    };

    const token = localStorage.getItem('accessToken');
    if (token && !headers['Authorization']) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(normalizedPath, {
        ...options,
        headers,
    });

    if (!response.ok) {
        let message = `Request failed (${response.status})`;
        try {
            const errorBody = await response.json();
            message = errorBody.message || message;
        } catch { /* keep http status message */ }
        throw new Error(message);
    }

    return response.json();
}

// ---------- image URL resolver ----------
function resolveImageUrl(image) {
    if (!image) return 'https://via.placeholder.com/500';
    if (image.startsWith('http://') || image.startsWith('https://')) return image;
    return `${API_BASE_URL}/${image.replace(/^\/+/, '')}`;
}

// ---------- product normalizer ----------
export function normalizeProduct(product) {
    if (!product || typeof product !== 'object') return product;
    return {
        ...product,
        id: product.id,
        name: product.name || 'Unnamed product',
        price: product.price ?? product.selling_price ?? 0,
        originalPrice: product.originalPrice ?? product.original_price ?? product.mrp ?? null,
        image: resolveImageUrl(product.image ?? product.image_url),
        expiry: product.expiry
            ?? (product.expiry_date ? new Date(product.expiry_date).toLocaleDateString() : 'N/A'),
        location: product.location ?? product.city ?? 'Available from Bylot seller',
        distance: product.distance ?? product.distance_km ?? null,
        category: product.category ?? product.category_name ?? 'All',
    };
}

// ---------- products ----------
export async function fetchProducts(params = {}) {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
            searchParams.set(key, value);
        }
    });
    const query = searchParams.toString();
    const response = await apiRequest(`/api/items${query ? `?${query}` : ''}`);
    const data = response?.data ?? response;
    return Array.isArray(data) ? data.map(normalizeProduct) : [];
}

export async function fetchNearbyProducts(lat, lng, radius = 10) {
    const params = new URLSearchParams({
        lat,
        lng,
        radius,
    });

    try {
        const response = await apiRequest(`/api/items/nearby?${params}`);
        const data = response?.data ?? response;
        if (Array.isArray(data) && data.length > 0) {
            return data.map(normalizeProduct);
        }
    } catch (err) {
        console.warn('Nearby products failed, falling back to all products:', err.message);
    }

    // fallback — load all products when nearby returns empty or errors
    return fetchProducts();
}

export async function fetchProductById(id) {
    const response = await apiRequest(`/api/items/${id}`);
    const product = response?.data ?? response;
    return normalizeProduct(product);
}

// ---------- admin ----------
export async function adminDeleteProduct(id) {
    return apiRequest(`/api/items/${id}`, { method: 'DELETE' });
}

// ---------- seller ----------
export async function deleteProduct(id) {
    return apiRequest(`/api/items/${id}`, { method: 'DELETE' });
}

export async function uploadProduct(formData) {
    return apiRequest('/api/items', {
        method: 'POST',
        body: formData,
    });
}
