import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import bcrypt from 'bcrypt';
import { query, initDb } from './db.js';
import { requireAuth, requireAdmin, signToken } from './authMiddleware.js';
import { extractDistrict } from './districtUtils.js';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });

const app = express();
const port = 5000;
const clientApiKey = process.env.BYLOT_CLIENT_API_KEY;

const requireClientApiKey = (req, res, next) => {
    if (!clientApiKey) {
        return next();
    }

    const providedKey = req.header('x-api-key');
    if (providedKey !== clientApiKey) {
        return res.status(401).json({ message: 'Invalid or missing API key' });
    }

    return next();
};

// Configure Multer Storage
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, path.join(__dirname, 'uploads/'));
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});

const upload = multer({ storage });

app.use(cors());
app.use(express.json());
// Serve static files from uploads directory
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Initialize Database
initDb();

// Public Configuration endpoint for frontend
app.get('/api/config', (req, res) => {
    res.json({
        googleClientId: process.env.GOOGLE_CLIENT_ID || ''
    });
});

// Register Route
app.post('/api/register', async (req, res) => {
    const { name, email, password, phone } = req.body;

    try {
        // Check if user exists
        const userCheck = await query('SELECT * FROM users WHERE email = ?', [email]);
        if (userCheck.rows.length > 0) {
            return res.status(400).json({ message: 'User already exists' });
        }

        // Hash password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Insert user (MySQL doesn't support RETURNING, fetch separately)
        const result = await query(
            'INSERT INTO users (name, email, password, phone) VALUES (?, ?, ?, ?)',
            [name, email, hashedPassword, phone]
        );

        const newUser = await query('SELECT id, name, email, phone, role FROM users WHERE id = ?', [result.insertId]);
        const user = newUser.rows[0];
        const token = signToken(user);
        res.status(201).json({ message: 'User registered successfully', user: { ...user, token } });
    } catch (err) {
        console.error('[API_REGISTER_ERROR]', err);
        res.status(500).json({ message: 'Server error during registration', errorId: 'ERR_REGISTER_500' });
    }
});

// Generate OTP Route (Mock)
app.post('/api/auth/send-otp', async (req, res) => {
    const { phone } = req.body;
    if (!phone) return res.status(400).json({ message: 'Phone number is required' });

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60000); // 10 minutes from now
    // MySQL DATETIME format
    const expiresAtStr = expiresAt.toISOString().slice(0, 19).replace('T', ' ');

    try {
        // Store OTP in DB
        await query(
            'INSERT INTO verification_codes (phone, code, expires_at) VALUES (?, ?, ?)',
            [phone, otp, expiresAtStr]
        );

        console.log(`[MOCK SMS] OTP for ${phone}: ${otp}`); // Mock sending SMS
        res.json({ message: 'OTP sent successfully', otp });
    } catch (err) {
        console.error('[API_SEND_OTP_ERROR]', err);
        res.status(500).json({ message: 'Server error during OTP generation', errorId: 'ERR_SEND_OTP_500' });
    }
});

import { OAuth2Client } from 'google-auth-library';

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// Verify OTP Route
app.post('/api/auth/verify-otp', async (req, res) => {
    const { phone, otp } = req.body;

    try {
        const result = await query(
            'SELECT * FROM verification_codes WHERE phone = ? AND code = ? AND expires_at > NOW() ORDER BY created_at DESC LIMIT 1',
            [phone, otp]
        );

        if (result.rows.length === 0) {
            return res.status(400).json({ message: 'Invalid or expired OTP' });
        }

        res.json({ message: 'OTP verified successfully' });
    } catch (err) {
        console.error('[API_VERIFY_OTP_ERROR]', err);
        res.status(500).json({ message: 'Server error during OTP verification', errorId: 'ERR_VERIFY_OTP_500' });
    }
});

const ADMIN_EMAILS = new Set([
    'nagarjunavenkatesan@gmail.com',
    ...(process.env.ADMIN_EMAIL ? [process.env.ADMIN_EMAIL] : []),
]);

// Google Auth Route
app.post('/api/auth/google', async (req, res) => {
    const { token, idToken } = req.body;
    const googleToken = token || idToken;

    if (!googleToken) {
        return res.status(400).json({ message: 'Google token is required' });
    }

    try {
        const ticket = await client.verifyIdToken({
            idToken: googleToken,
            audience: process.env.GOOGLE_CLIENT_ID,
        });
        const { name, email, sub: googleId, picture } = ticket.getPayload();
        const isAdminEmail = ADMIN_EMAILS.has(email);

        // Check if user exists
        let userResult = await query('SELECT * FROM users WHERE email = ?', [email]);

        if (userResult.rows.length === 0) {
            const ins = await query(
                'INSERT INTO users (name, email, google_id, role, status) VALUES (?, ?, ?, ?, ?)',
                [name, email, googleId, isAdminEmail ? 'admin' : 'user', 'active']
            );
            userResult = await query('SELECT * FROM users WHERE id = ?', [ins.insertId]);
        } else {
            if (!userResult.rows[0].google_id) {
                await query('UPDATE users SET google_id = ? WHERE email = ?', [googleId, email]);
            }
            if (isAdminEmail) {
                await query("UPDATE users SET role = 'admin', status = 'active' WHERE email = ?", [email]);
                userResult = await query('SELECT * FROM users WHERE email = ?', [email]);
            }
        }

        const user = userResult.rows[0];
        const accessToken = signToken(user);
        res.json({
            message: 'Login successful',
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                avatar: picture,
                role: user.role,
                status: user.status || 'active',
                token: accessToken,
            },
            data: {
                user: {
                    id: user.id,
                    name: user.name,
                    email: user.email,
                    avatar: picture,
                    role: user.role,
                    status: user.status || 'active',
                },
                accessToken,
            },
        });

    } catch (err) {
        console.error('[API_GOOGLE_AUTH_ERROR]', err);
        res.status(401).json({ message: 'Invalid Google Token', errorId: 'ERR_GOOGLE_AUTH_401' });
    }
});

// Login Route
app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;

    try {
        // Check if user exists
        const userResult = await query('SELECT * FROM users WHERE email = ?', [email]);
        if (userResult.rows.length === 0) {
            return res.status(400).json({ message: 'Invalid credentials' });
        }

        const user = userResult.rows[0];

        // Check password
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ message: 'Invalid credentials' });
        }

        const token = signToken(user);
        res.json({ message: 'Login successful', user: { id: user.id, name: user.name, email: user.email, role: user.role, token } });
    } catch (err) {
        console.error('[API_LOGIN_ERROR]', err);
        res.status(500).json({ message: 'Server error during login', errorId: 'ERR_LOGIN_500' });
    }
});

// Admin Login Route
app.post('/api/admin/login', async (req, res) => {
    const { email, password } = req.body;

    try {
        const userResult = await query('SELECT * FROM users WHERE email = ? LIMIT 1', [email]);
        if (userResult.rows.length === 0) {
            return res.status(401).json({ message: 'Invalid admin credentials' });
        }

        const user = userResult.rows[0];
        const isAdmin = user.role === 'admin' && (!user.status || user.status === 'active');
        const isMatch = await bcrypt.compare(password, user.password || '');

        if (!isAdmin || !isMatch) {
            return res.status(401).json({ message: 'Invalid admin credentials' });
        }

        const token = signToken(user);
        res.json({
            success: true,
            message: 'Admin login successful',
            data: {
                user: { id: user.id, name: user.name, email: user.email, role: user.role, status: user.status || 'active' },
                accessToken: token
            }
        });
    } catch (err) {
        console.error('[API_ADMIN_LOGIN_ERROR]', err);
        res.status(500).json({ message: 'Server error during admin login', errorId: 'ERR_ADMIN_LOGIN_500' });
    }
});

app.get('/api/admin/dashboard', requireAuth, requireAdmin, async (req, res) => {
    try {
        const [users, sellers, products] = await Promise.all([
            query("SELECT COUNT(*) AS total FROM users WHERE role <> 'admin'"),
            query("SELECT COUNT(*) AS total FROM users WHERE role = 'seller'"),
            query('SELECT COUNT(*) AS total FROM items')
        ]);

        res.json({
            success: true,
            data: {
                totalUsers: users.rows[0]?.total || 0,
                totalSellers: sellers.rows[0]?.total || 0,
                totalProducts: products.rows[0]?.total || 0,
                totalOrders: 0,
                revenue: 0
            }
        });
    } catch (err) {
        console.error('[API_ADMIN_DASHBOARD_ERROR]', err);
        res.status(500).json({ message: 'Server error fetching admin dashboard' });
    }
});

app.get('/api/admin/users', requireAuth, requireAdmin, async (req, res) => {
    try {
        const users = await query('SELECT id, name, email, phone, role, status, created_at FROM users ORDER BY created_at DESC LIMIT 50');
        res.json({ success: true, data: users.rows });
    } catch (err) {
        console.error('[API_ADMIN_USERS_ERROR]', err);
        res.status(500).json({ message: 'Server error fetching users' });
    }
});

app.patch('/api/admin/users/:id/status', requireAuth, requireAdmin, async (req, res) => {
    const status = req.body.status === 'blocked' ? 'blocked' : 'active';

    try {
        const result = await query('UPDATE users SET status = ? WHERE id = ?', [status, req.params.id]);
        if (result.rowCount === 0) return res.status(404).json({ message: 'User not found' });
        res.json({ success: true, message: 'User status updated successfully' });
    } catch (err) {
        console.error('[API_ADMIN_USER_STATUS_ERROR]', err);
        res.status(500).json({ message: 'Server error updating user status' });
    }
});

app.get('/api/admin/sellers', requireAuth, requireAdmin, async (req, res) => {
    try {
        const sellers = await query(`
            SELECT
                id,
                name AS business_name,
                name,
                email,
                status,
                IF(status = 'blocked', 'rejected', 'approved') AS approval_status,
                created_at
            FROM users
            WHERE role = 'seller'
            ORDER BY created_at DESC
            LIMIT 50
        `);
        res.json({ success: true, data: sellers.rows });
    } catch (err) {
        console.error('[API_ADMIN_SELLERS_ERROR]', err);
        res.status(500).json({ message: 'Server error fetching sellers' });
    }
});

app.patch('/api/admin/sellers/:id/approve', requireAuth, requireAdmin, async (req, res) => {
    const status = req.body.approvalStatus === 'rejected' ? 'blocked' : 'active';

    try {
        const result = await query("UPDATE users SET role = 'seller', status = ? WHERE id = ?", [status, req.params.id]);
        if (result.rowCount === 0) return res.status(404).json({ message: 'Seller not found' });
        res.json({ success: true, message: 'Seller approval updated successfully' });
    } catch (err) {
        console.error('[API_ADMIN_SELLER_APPROVAL_ERROR]', err);
        res.status(500).json({ message: 'Server error updating seller approval' });
    }
});

app.get('/api/admin/products', requireAuth, requireAdmin, async (req, res) => {
    try {
        const products = await query(`
            SELECT
                items.*,
                users.name AS seller_name,
                items.category AS category_name
            FROM items
            LEFT JOIN users ON items.seller_id = users.id
            ORDER BY items.created_at DESC
            LIMIT 50
        `);
        res.json({ success: true, data: products.rows });
    } catch (err) {
        console.error('[API_ADMIN_PRODUCTS_ERROR]', err);
        res.status(500).json({ message: 'Server error fetching products' });
    }
});

app.get('/api/admin/district-analytics', requireAuth, requireAdmin, async (req, res) => {
    try {
        const [sellRows, buyRows] = await Promise.all([
            query(`
                SELECT
                    COALESCE(NULLIF(TRIM(district), ''), 'Unassigned') AS district,
                    COUNT(*) AS sell_count,
                    COALESCE(SUM(price), 0) AS sell_value
                FROM items
                GROUP BY COALESCE(NULLIF(TRIM(district), ''), 'Unassigned')
                ORDER BY sell_count DESC, district ASC
            `),
            query(`
                SELECT
                    COALESCE(NULLIF(TRIM(district), ''), 'Unassigned') AS district,
                    COUNT(*) AS buy_count,
                    COALESCE(SUM(amount), 0) AS buy_value
                FROM orders
                WHERE status = 'completed'
                GROUP BY COALESCE(NULLIF(TRIM(district), ''), 'Unassigned')
                ORDER BY buy_count DESC, district ASC
            `),
        ]);

        const districtMap = new Map();

        sellRows.rows.forEach((row) => {
            districtMap.set(row.district, {
                district: row.district,
                sellCount: Number(row.sell_count) || 0,
                sellValue: Number(row.sell_value) || 0,
                buyCount: 0,
                buyValue: 0,
            });
        });

        buyRows.rows.forEach((row) => {
            const existing = districtMap.get(row.district) || {
                district: row.district,
                sellCount: 0,
                sellValue: 0,
                buyCount: 0,
                buyValue: 0,
            };
            existing.buyCount = Number(row.buy_count) || 0;
            existing.buyValue = Number(row.buy_value) || 0;
            districtMap.set(row.district, existing);
        });

        const data = Array.from(districtMap.values()).sort((a, b) => {
            const totalA = a.sellCount + a.buyCount;
            const totalB = b.sellCount + b.buyCount;
            return totalB - totalA || a.district.localeCompare(b.district);
        });

        res.json({
            success: true,
            data,
            totals: {
                sellCount: data.reduce((sum, row) => sum + row.sellCount, 0),
                sellValue: data.reduce((sum, row) => sum + row.sellValue, 0),
                buyCount: data.reduce((sum, row) => sum + row.buyCount, 0),
                buyValue: data.reduce((sum, row) => sum + row.buyValue, 0),
            },
        });
    } catch (err) {
        console.error('[API_ADMIN_DISTRICT_ANALYTICS_ERROR]', err);
        res.status(500).json({ message: 'Server error fetching district analytics' });
    }
});

app.patch('/api/admin/products/:id/status', requireAuth, requireAdmin, async (req, res) => {
    const allowedStatuses = ['draft', 'active', 'inactive', 'out_of_stock', 'blocked'];
    const status = allowedStatuses.includes(req.body.status) ? req.body.status : 'active';

    try {
        const result = await query('UPDATE items SET status = ? WHERE id = ?', [status, req.params.id]);
        if (result.rowCount === 0) return res.status(404).json({ message: 'Product not found' });
        res.json({ success: true, message: 'Product status updated successfully' });
    } catch (err) {
        console.error('[API_ADMIN_PRODUCT_STATUS_ERROR]', err);
        res.status(500).json({ message: 'Server error updating product status' });
    }
});

// Create purchase order (district-wise buy tracking)
app.post('/api/orders', requireAuth, async (req, res) => {
    const { itemId } = req.body;

    if (!itemId) {
        return res.status(400).json({ message: 'Item ID is required' });
    }

    try {
        const itemResult = await query('SELECT * FROM items WHERE id = ? LIMIT 1', [itemId]);
        if (itemResult.rows.length === 0) {
            return res.status(404).json({ message: 'Item not found' });
        }

        const item = itemResult.rows[0];
        if (item.seller_id === req.user.id) {
            return res.status(400).json({ message: 'You cannot buy your own listing' });
        }

        const district = extractDistrict(item.location, item.district);
        const amount = item.price ?? 0;

        const result = await query(
            'INSERT INTO orders (item_id, buyer_id, seller_id, district, amount, status) VALUES (?, ?, ?, ?, ?, ?)',
            [itemId, req.user.id, item.seller_id, district, amount, 'completed']
        );

        const order = await query('SELECT * FROM orders WHERE id = ?', [result.insertId]);
        res.status(201).json({ message: 'Purchase recorded successfully', order: order.rows[0] });
    } catch (err) {
        console.error('[API_CREATE_ORDER_ERROR]', err);
        res.status(500).json({ message: 'Server error recording purchase' });
    }
});

// Create Item Route
app.post('/api/items', requireAuth, upload.single('image'), async (req, res) => {
    const { name, description, expiryDate, category, location, locationLink, district } = req.body;
    const sellerId = req.user.id;
    // Sanitizing numeric inputs
    const price = req.body.price === '' ? null : req.body.price;
    const originalPrice = req.body.originalPrice === '' ? null : req.body.originalPrice;
    const latitude = req.body.latitude === '' ? null : req.body.latitude;
    const longitude = req.body.longitude === '' ? null : req.body.longitude;
    let imageUrl = req.body.imageUrl; // Keep fallback if provided

    if (req.file) {
        imageUrl = `/uploads/${req.file.filename}`;
    }

    let formattedExpiry = expiryDate === '' ? null : expiryDate;
    if (formattedExpiry && formattedExpiry.includes('T')) {
        formattedExpiry = formattedExpiry.split('T')[0];
    }

    const resolvedDistrict = extractDistrict(location, district);

    try {
        const result = await query(
            `INSERT INTO items (name, description, price, original_price, expiry_date, category, location, location_link, latitude, longitude, seller_id, image_url, district)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [name, description, price, originalPrice, formattedExpiry, category, location, locationLink, latitude, longitude, sellerId, imageUrl, resolvedDistrict]
        );

        const newItem = await query('SELECT * FROM items WHERE id = ?', [result.insertId]);
        res.status(201).json({ message: 'Item created successfully', item: newItem.rows[0] });
    } catch (err) {
        console.error('[API_CREATE_ITEM_ERROR]', err);
        res.status(500).json({ message: 'Server error during item creation', errorId: 'ERR_CREATE_ITEM_500' });
    }
});

// Get Items Route (with optional location filtering)
app.get(['/api/items', '/api/products'], async (req, res) => {
    const { lat, lng } = req.query;

    try {
        let items;
        if (lat && lng) {
            // Haversine formula — same SQL works in MySQL
            const queryText = `
                SELECT *,
                (
                    6371 * acos(
                        cos(radians(?)) * cos(radians(latitude)) * cos(radians(longitude) - radians(?)) +
                        sin(radians(?)) * sin(radians(latitude))
                    )
                ) AS distance
                FROM items
                ORDER BY distance ASC
            `;
            items = await query(queryText, [lat, lng, lat]);
        } else if (req.query.sellerId) {
            items = await query('SELECT * FROM items WHERE seller_id = ? ORDER BY created_at DESC', [req.query.sellerId]);
        } else {
            items = await query('SELECT * FROM items ORDER BY created_at DESC');
        }
        res.json(items.rows);
    } catch (err) {
        console.error('[API_GET_ITEMS_ERROR]', err);
        res.status(500).json({ message: 'Server error fetching items', errorId: 'ERR_GET_ITEMS_500' });
    }
});

// Shared Android/Web products endpoint.
app.get('/products', requireClientApiKey, async (req, res) => {
    try {
        const latitude = req.query.latitude || req.query.lat;
        const longitude = req.query.longitude || req.query.lng;

        if (latitude && longitude) {
            const products = await query(`
                SELECT
                    id,
                    name,
                    price,
                    image_url AS image,
                    original_price,
                    expiry_date,
                    category,
                    location,
                    location_link,
                    latitude,
                    longitude,
                    seller_id,
                    (
                        6371 * acos(
                            cos(radians(?)) * cos(radians(latitude)) * cos(radians(longitude) - radians(?)) +
                            sin(radians(?)) * sin(radians(latitude))
                        )
                    ) AS distance
                FROM items
                ORDER BY distance ASC
            `, [latitude, longitude, latitude]);

            return res.json(products.rows);
        }

        const products = await query(`
            SELECT
                id,
                name,
                price,
                image_url AS image,
                original_price,
                expiry_date,
                category,
                location,
                location_link,
                latitude,
                longitude,
                seller_id
            FROM items
            ORDER BY created_at DESC
        `);

        res.json(products.rows);
    } catch (err) {
        console.error('[API_GET_PRODUCTS_ERROR]', err);
        res.status(500).json({ message: 'Server error fetching products' });
    }
});

app.get('/products/:id', requireClientApiKey, async (req, res) => {
    try {
        const product = await query(
            `SELECT
                items.id,
                items.name,
                items.description,
                items.price,
                items.image_url AS image,
                items.original_price,
                items.expiry_date,
                items.category,
                items.location,
                items.location_link,
                items.latitude,
                items.longitude,
                items.seller_id,
                users.name AS seller_name
             FROM items
             JOIN users ON items.seller_id = users.id
             WHERE items.id = ?`,
            [req.params.id]
        );

        if (product.rows.length === 0) {
            return res.status(404).json({ message: 'Product not found' });
        }

        res.json(product.rows[0]);
    } catch (err) {
        console.error('[API_GET_PRODUCT_ERROR]', err);
        res.status(500).json({ message: 'Server error fetching product' });
    }
});

// Get Single Item Route
app.get(['/api/items/:id', '/api/products/:id'], async (req, res) => {
    const { id } = req.params;
    try {
        const item = await query(
            'SELECT items.*, users.name as seller_name FROM items JOIN users ON items.seller_id = users.id WHERE items.id = ?',
            [id]
        );
        if (item.rows.length === 0) {
            return res.status(404).json({ message: 'Item not found' });
        }
        res.json(item.rows[0]);
    } catch (err) {
        console.error('[API_GET_ITEM_ERROR]', err);
        res.status(500).json({ message: 'Server error fetching item details', errorId: 'ERR_GET_ITEM_500' });
    }
});

// Get User Details (Public Profile)
app.get('/api/users/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const result = await query('SELECT id, name, email, phone, created_at FROM users WHERE id = ?', [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'User not found' });
        }
        res.json(result.rows[0]);
    } catch (err) {
        console.error('[API_GET_USER_ERROR]', err);
        res.status(500).json({ message: 'Server error fetching user details', errorId: 'ERR_GET_USER_500' });
    }
});

// Update Item Route
app.put(['/api/items/:id', '/api/products/:id'], requireAuth, async (req, res) => {
    const { id } = req.params;
    const { name, description, price, originalPrice, expiryDate, category, location, locationLink, imageUrl } = req.body;

    let formattedExpiry = expiryDate === '' ? null : expiryDate;
    if (formattedExpiry && formattedExpiry.includes('T')) {
        formattedExpiry = formattedExpiry.split('T')[0];
    }

    try {
        if (req.user.role !== 'admin') {
             const checkOwner = await query('SELECT seller_id FROM items WHERE id = ?', [id]);
             if (checkOwner.rows.length === 0 || checkOwner.rows[0].seller_id !== req.user.id) {
                 return res.status(403).json({ message: 'Forbidden: You do not own this item' });
             }
        }
        const result = await query(
            'UPDATE items SET name=?, description=?, price=?, original_price=?, expiry_date=?, category=?, location=?, location_link=?, image_url=? WHERE id=?',
            [name, description, price, originalPrice, formattedExpiry, category, location, locationLink, imageUrl, id]
        );
        if (result.rowCount === 0) {
            return res.status(404).json({ message: 'Item not found' });
        }
        const updated = await query('SELECT * FROM items WHERE id = ?', [id]);
        res.json({ message: 'Item updated successfully', item: updated.rows[0] });
    } catch (err) {
        console.error('[API_UPDATE_ITEM_ERROR]', err);
        res.status(500).json({ message: 'Server error updating item', errorId: 'ERR_UPDATE_ITEM_500' });
    }
});

// Update User Route
app.put('/api/users/:id', requireAuth, async (req, res) => {
    const { id } = req.params;
    const { phone } = req.body;

    try {
        if (req.user.role !== 'admin' && req.user.id !== parseInt(id)) {
             return res.status(403).json({ message: 'Forbidden: You cannot modify this profile' });
        }
        const result = await query('UPDATE users SET phone = ? WHERE id = ?', [phone, id]);
        if (result.rowCount === 0) {
            return res.status(404).json({ message: 'User not found' });
        }
        const updated = await query('SELECT id, name, email, phone, google_id, created_at FROM users WHERE id = ?', [id]);
        res.json({ message: 'User updated successfully', user: updated.rows[0] });
    } catch (err) {
        console.error('[API_UPDATE_USER_ERROR]', err);
        res.status(500).json({ message: 'Server error updating user profile', errorId: 'ERR_UPDATE_USER_500' });
    }
});

// Delete Item Route
app.delete(['/api/items/:id', '/api/products/:id', '/api/sellers/products/:id'], requireAuth, async (req, res) => {
    const { id } = req.params;
    console.log(`[DELETE] Request for item ID: ${id} by user: ${req.user.id}`);
    try {
        if (req.user.role !== 'admin') {
             const checkOwner = await query('SELECT seller_id FROM items WHERE id = ?', [id]);
             if (checkOwner.rows.length === 0 || checkOwner.rows[0].seller_id !== req.user.id) {
                 return res.status(403).json({ message: 'Forbidden: You do not own this item' });
             }
        }
        const result = await query('DELETE FROM items WHERE id = ?', [id]);
        if (result.rowCount === 0) {
            console.log(`[DELETE] Item ${id} not found`);
            return res.status(404).json({ message: 'Item not found' });
        }
        console.log(`[DELETE] Item ${id} deleted successfully`);
        res.json({ message: 'Item deleted successfully' });
    } catch (err) {
        console.error('[API_DELETE_ITEM_ERROR]', err);
        res.status(500).json({ message: 'Server error deleting item', errorId: 'ERR_DELETE_ITEM_500' });
    }
});

// Compatibility route for new admin structure
app.delete('/api/admin/products/:id', requireAuth, requireAdmin, async (req, res) => {
    const { id } = req.params;
    try {
        const result = await query('DELETE FROM items WHERE id = ?', [id]);
        if (result.rowCount === 0) {
            return res.status(404).json({ message: 'Item not found' });
        }
        res.json({ message: 'Item deleted successfully' });
    } catch (err) {
        console.error('[API_ADMIN_DELETE_ITEM_ERROR]', err);
        res.status(500).json({ message: 'Server error deleting item' });
    }
});


// Chat Route (Mock AI)
app.post('/api/chat', (req, res) => {
    const { message } = req.body;
    const lowerMsg = message.toLowerCase();

    let reply = "I'm not sure about that. Try asking how to sell items or browse deals!";

    if (lowerMsg.includes('hello') || lowerMsg.includes('hi')) {
        reply = "Hello! I'm here to help you fight food waste. Ask me how to buy or sell!";
    } else if (lowerMsg.includes('sell') || lowerMsg.includes('list')) {
        reply = "To sell an item, click the 'Sell' button in the navigation bar. You'll need to share your location and add a photo.";
    } else if (lowerMsg.includes('buy') || lowerMsg.includes('browse')) {
        reply = "You can browse items by clicking 'Browse'. Use filters to find food near you!";
    } else if (lowerMsg.includes('price') || lowerMsg.includes('cost')) {
        reply = "Sellers set their own prices. We encourage low prices to help clear stock quickly.";
    } else if (lowerMsg.includes('account') || lowerMsg.includes('profile')) {
        reply = "Go to your Profile to see your listings and update your details.";
    }

    // Simulate network delay
    setTimeout(() => {
        res.json({ reply });
    }, 500);
});

app.listen(port, '0.0.0.0', () => {
    console.log(`Server running on all interfaces at port ${port}`);
});
