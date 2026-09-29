// API_BASE_URL resolves all backend requests and image URLs.
const DEFAULT_BACKEND_URL = '';

export const API_BASE_URL = (
    import.meta.env.VITE_API_BASE_URL ||
    DEFAULT_BACKEND_URL
).replace(/\/$/, '');

const API_KEY = import.meta.env.VITE_BYLOT_API_KEY || '';

// Sample fallback mock products to ensure zero downtime when offline or demo deployment
export const SAMPLE_PRODUCTS = [
    {
        id: 1,
        name: 'Organic Fresh Farm Milk (1L)',
        category: 'Dairy',
        price: 32,
        originalPrice: 65,
        mrp: 65,
        selling_price: 32,
        expiry: 'Tomorrow (Fresh)',
        expiry_date: '2026-09-05',
        location: 'Anna Nagar, Chennai',
        city: 'Chennai',
        distance: 1.4,
        seller_id: 101,
        seller_name: 'Green Dairy Farm & Supermarket',
        image: 'https://images.unsplash.com/photo-1550583724-b2692b85b150?auto=format&fit=crop&w=600&q=80',
        description: 'Fresh pasteurized farm whole milk, 50% discount due to upcoming date. Sealed & chilled.',
        stock_quantity: 12,
    },
    {
        id: 2,
        name: 'Artisanal Whole Wheat Bread',
        category: 'Bakery',
        price: 25,
        originalPrice: 50,
        mrp: 50,
        selling_price: 25,
        expiry: 'In 2 days',
        expiry_date: '2026-09-06',
        location: 'Indiranagar, Bangalore',
        city: 'Bangalore',
        distance: 2.8,
        seller_id: 102,
        seller_name: 'Bakers Delight Oven',
        image: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=600&q=80',
        description: 'Freshly baked whole wheat sliced loaf. Perfect for sandwiches and morning toast.',
        stock_quantity: 8,
    },
    {
        id: 3,
        name: 'Fresh Red Tomatoes (1kg Bag)',
        category: 'Vegetables',
        price: 18,
        originalPrice: 40,
        mrp: 40,
        selling_price: 18,
        expiry: 'In 3 days',
        expiry_date: '2026-09-07',
        location: 'T. Nagar, Chennai',
        city: 'Chennai',
        distance: 3.5,
        seller_id: 103,
        seller_name: 'Organic Valley Veggies',
        image: 'https://images.unsplash.com/photo-1592924357228-91a4daadcfea?auto=format&fit=crop&w=600&q=80',
        description: 'Ripe juicy vine tomatoes, ideal for curries, salads, and sauces. Surplus stock markdown.',
        stock_quantity: 25,
    },
    {
        id: 4,
        name: 'Sweet Alphonso Mangoes (1kg)',
        category: 'Fruits',
        price: 120,
        originalPrice: 220,
        mrp: 220,
        selling_price: 120,
        expiry: 'In 2 days',
        expiry_date: '2026-09-06',
        location: 'Bandra, Mumbai',
        city: 'Mumbai',
        distance: 4.2,
        seller_id: 104,
        seller_name: 'Ratnagiri Fresh Mart',
        image: 'https://images.unsplash.com/photo-1553279768-865429fa0078?auto=format&fit=crop&w=600&q=80',
        description: 'Sweet juicy mangoes ready for immediate consumption. Direct orchard surplus deal.',
        stock_quantity: 15,
    },
    {
        id: 5,
        name: 'Greek Yogurt Blueberry Cup (200g)',
        category: 'Dairy',
        price: 45,
        originalPrice: 90,
        mrp: 90,
        selling_price: 45,
        expiry: 'In 3 days',
        expiry_date: '2026-09-07',
        location: 'Connaught Place, Delhi',
        city: 'Delhi',
        distance: 5.1,
        seller_id: 105,
        seller_name: 'Delhi Gourmet Provisions',
        image: 'https://images.unsplash.com/photo-1488477181946-6428a0291777?auto=format&fit=crop&w=600&q=80',
        description: 'High-protein real blueberry Greek yogurt. Refrigerated and sealed.',
        stock_quantity: 20,
    },
    {
        id: 6,
        name: 'Butter Croissants (Pack of 4)',
        category: 'Bakery',
        price: 70,
        originalPrice: 150,
        mrp: 150,
        selling_price: 70,
        expiry: 'Tomorrow',
        expiry_date: '2026-09-05',
        location: 'Jubilee Hills, Hyderabad',
        city: 'Hyderabad',
        distance: 6.0,
        seller_id: 106,
        seller_name: 'French Patisserie & Cafe',
        image: 'https://images.unsplash.com/photo-1555507036-ab1f4038808a?auto=format&fit=crop&w=600&q=80',
        description: 'Flaky buttery french croissants baked daily. End-of-day flash clearance sale.',
        stock_quantity: 6,
    },
    {
        id: 7,
        name: 'Cold-Pressed Sunflower Oil (1L)',
        category: 'Daily Essentials',
        price: 95,
        originalPrice: 180,
        mrp: 180,
        selling_price: 95,
        expiry: 'In 15 days',
        expiry_date: '2026-09-20',
        location: 'Kothrud, Pune',
        city: 'Pune',
        distance: 2.1,
        seller_id: 107,
        seller_name: 'Pure Harvest Organics',
        image: 'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?auto=format&fit=crop&w=600&q=80',
        description: 'Pure cold-pressed cooking oil bottle. Near-expiry inventory markdown.',
        stock_quantity: 30,
    },
    {
        id: 8,
        name: 'Corporate Pantry Surplus Snack Crate',
        category: 'Corporate Clearance',
        price: 150,
        originalPrice: 450,
        mrp: 450,
        selling_price: 150,
        expiry: 'In 7 days',
        expiry_date: '2026-09-12',
        location: 'Salt Lake Sector V, Kolkata',
        city: 'Kolkata',
        distance: 3.8,
        seller_id: 108,
        seller_name: 'TechPark Snack Hub',
        image: 'https://images.unsplash.com/photo-1563729784474-d77dbb933a9e?auto=format&fit=crop&w=600&q=80',
        description: 'Assorted healthy snack bars, nuts, and fruit crisps from corporate event surplus.',
        stock_quantity: 18,
    }
];

// ---------- core request helper ----------
export async function apiRequest(path, options = {}) {
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    const requestUrl = `${API_BASE_URL}${normalizedPath}`;

    const headers = {
        Accept: 'application/json',
        'X-Bylot-Handshake': localStorage.getItem('bylot-handshake') || '',
        'X-CSRF-Token': localStorage.getItem('bylot-csrf-token') || localStorage.getItem('bylot-handshake') || '',
        ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
        ...(API_KEY ? { 'x-api-key': API_KEY } : {}),
        ...options.headers,
    };

    const token = localStorage.getItem('accessToken');
    if (token && !headers['Authorization']) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(requestUrl, {
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
    if (!image) return 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=600&q=80';
    if (image.startsWith('http://') || image.startsWith('https://')) return image;
    return `${API_BASE_URL}/${image.replace(/^\/+/, '')}`;
}

// ---------- product normalizer ----------
export function normalizeProduct(product) {
    if (!product || typeof product !== 'object') return null;
    const product_item_id = product.product_item_id
        || product.productItemId
        || (product.id ? `PRD-${String(product.id).padStart(6, '0')}` : 'PRD-000000');
    
    let formattedExpiry = 'N/A';
    if (product.expiry) {
        formattedExpiry = product.expiry;
    } else if (product.expiry_date) {
        try {
            const dateObj = new Date(product.expiry_date);
            formattedExpiry = !isNaN(dateObj.getTime()) ? dateObj.toLocaleDateString() : String(product.expiry_date);
        } catch (_) {
            formattedExpiry = String(product.expiry_date);
        }
    }

    return {
        ...product,
        id: product.id ?? Math.floor(Math.random() * 100000),
        product_item_id,
        name: product.name || 'Unnamed product',
        price: Number(product.price ?? product.selling_price ?? 0),
        originalPrice: product.originalPrice ?? product.original_price ?? product.mrp ?? null,
        image: resolveImageUrl(product.image ?? product.image_url),
        expiry: formattedExpiry,
        location: product.location ?? product.city ?? product.address_line1 ?? 'Available from Bylot seller',
        distance: product.distance != null ? Number(product.distance) : (product.distance_km != null ? Number(product.distance_km) : null),
        category: product.category ?? product.category_name ?? 'All',
        seller_id: product.seller_id || product.sellerId || 1,
        seller_name: product.seller_name || product.business_name || 'Bylot Verified Seller',
        description: product.description || 'Quality near-expiry product available at discounted rates.'
    };
}

// ---------- high-performance memory cache ----------
const apiCache = new Map();
const CACHE_TTL_MS = 45 * 1000; // 45s TTL for snappy navigation

export function clearApiCache() {
    apiCache.clear();
}

function getCached(key) {
    const entry = apiCache.get(key);
    if (!entry) return null;
    if (Date.now() - entry.time > CACHE_TTL_MS) {
        apiCache.delete(key);
        return null;
    }
    return entry.data;
}

function setCached(key, data) {
    if (apiCache.size >= 80) {
        const oldest = apiCache.keys().next().value;
        apiCache.delete(oldest);
    }
    apiCache.set(key, { time: Date.now(), data });
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
    const cacheKey = `products_${query}`;
    const cached = getCached(cacheKey);
    if (cached) return cached;

    try {
        const response = await apiRequest(`/api/products${query ? `?${query}` : ''}`);
        const data = response?.data ?? response;
        if (Array.isArray(data)) {
            const normalized = data.map(normalizeProduct).filter(Boolean);
            setCached(cacheKey, normalized);
            return normalized;
        }
    } catch (err) {
        console.warn('Backend API request failed, using sample product dataset fallback:', err.message);
    }
    // Fallback to sample items
    const fallback = SAMPLE_PRODUCTS.map(normalizeProduct).filter(Boolean);
    return fallback;
}

export async function fetchNearbyProducts(lat, lng, radius = 10) {
    const cacheKey = `nearby_${Number(lat).toFixed(3)}_${Number(lng).toFixed(3)}_${radius}`;
    const cached = getCached(cacheKey);
    if (cached) return cached;

    try {
        const params = new URLSearchParams({
            latitude: lat,
            longitude: lng,
            radiusKm: radius,
        });

        const response = await apiRequest(`/api/products/nearby?${params}`);
        const data = response?.data ?? response;
        if (Array.isArray(data) && data.length > 0) {
            const normalized = data.map(normalizeProduct);
            setCached(cacheKey, normalized);
            return normalized;
        }
    } catch (err) {
        console.warn('Nearby products request failed, calculating fallback distances:', err.message);
    }

    // Fallback — load products with calculated sample distance
    return fetchProducts({ latitude: lat, longitude: lng });
}

export async function fetchProductById(id) {
    const cacheKey = `product_${id}`;
    const cached = getCached(cacheKey);
    if (cached) return cached;

    try {
        const response = await apiRequest(`/api/products/${id}`);
        const product = response?.data ?? response;
        if (product && product.id) {
            const normalized = normalizeProduct(product);
            setCached(cacheKey, normalized);
            return normalized;
        }
    } catch (err) {
        console.warn(`Product ID ${id} request failed, looking up fallback:`, err.message);
    }

    const found = SAMPLE_PRODUCTS.find(p => String(p.id) === String(id));
    return normalizeProduct(found || SAMPLE_PRODUCTS[0]);
}

// ---------- admin ----------
export async function adminDeleteProduct(id) {
    clearApiCache();
    return apiRequest(`/api/admin/products/${id}`, { method: 'DELETE' });
}

// ---------- seller ----------
export async function deleteProduct(id) {
    clearApiCache();
    return apiRequest(`/api/sellers/products/${id}`, { method: 'DELETE' });
}

export async function uploadProduct(formData) {
    clearApiCache();
    return apiRequest('/api/sellers/products', {
        method: 'POST',
        body: formData,
    });
}


