import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import bcrypt from 'bcrypt';
import { query, initDb } from './db.js';

import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const app = express();
const port = process.env.PORT || 5000;

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

// Register Route
app.post('/api/register', async (req, res) => {
    const { name, email, password, phone } = req.body;

    try {
        // Check if user exists
        const userCheck = await query('SELECT * FROM users WHERE email = $1', [email]);
        if (userCheck.rows.length > 0) {
            return res.status(400).json({ message: 'User already exists' });
        }

        // Hash password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Insert user
        const newUser = await query(
            'INSERT INTO users (name, email, password, phone) VALUES ($1, $2, $3, $4) RETURNING id, name, email, phone',
            [name, email, hashedPassword, phone]
        );

        res.status(201).json({ message: 'User registered successfully', user: newUser.rows[0] });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// Generate OTP Route (Mock)
app.post('/api/auth/send-otp', async (req, res) => {
    const { phone } = req.body;
    if (!phone) return res.status(400).json({ message: 'Phone number is required' });

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60000); // 10 minutes from now

    try {
        // Store OTP in DB
        await query(
            'INSERT INTO verification_codes (phone, code, expires_at) VALUES ($1, $2, $3)',
            [phone, otp, expiresAt]
        );

        console.log(`[MOCK SMS] OTP for ${phone}: ${otp}`); // Mock sending SMS
        res.json({ message: 'OTP sent successfully', otp });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

import { OAuth2Client } from 'google-auth-library';

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// Verify OTP Route
app.post('/api/auth/verify-otp', async (req, res) => {
    const { phone, otp } = req.body;

    try {
        const result = await query(
            'SELECT * FROM verification_codes WHERE phone = $1 AND code = $2 AND expires_at > NOW() ORDER BY created_at DESC LIMIT 1',
            [phone, otp]
        );

        if (result.rows.length === 0) {
            return res.status(400).json({ message: 'Invalid or expired OTP' });
        }

        res.json({ message: 'OTP verified successfully' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// Google Auth Route
app.post('/api/auth/google', async (req, res) => {
    const { token } = req.body;
    try {
        const ticket = await client.verifyIdToken({
            idToken: token,
            audience: process.env.GOOGLE_CLIENT_ID,
        });
        const { name, email, sub: googleId, picture } = ticket.getPayload();

        // Check if user exists
        let userResult = await query('SELECT * FROM users WHERE email = $1', [email]);
        
        if (userResult.rows.length === 0) {
            // Create new Google user
            userResult = await query(
                'INSERT INTO users (name, email, google_id) VALUES ($1, $2, $3) RETURNING *',
                [name, email, googleId]
            );
        } else {
            // Update google_id if missing (linking account)
            if (!userResult.rows[0].google_id) {
                await query('UPDATE users SET google_id = $1 WHERE email = $2', [googleId, email]);
            }
        }

        const user = userResult.rows[0];
        // Ensure id is returned as number for frontend checks
        res.json({ 
            message: 'Login successful', 
            user: { 
                id: user.id, 
                name: user.name, 
                email: user.email,
                avatar: picture 
            } 
        });

    } catch (err) {
        console.error('Google Auth Error:', err);
        res.status(401).json({ message: 'Invalid Google Token' });
    }
});

// Login Route
app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;

    try {
        // Check if user exists
        const userResult = await query('SELECT * FROM users WHERE email = $1', [email]);
        if (userResult.rows.length === 0) {
            return res.status(400).json({ message: 'Invalid credentials' });
        }

        const user = userResult.rows[0];

        // Check password
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ message: 'Invalid credentials' });
        }

        res.json({ message: 'Login successful', user: { id: user.id, name: user.name, email: user.email } });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// Create Item Route
app.post('/api/items', upload.single('image'), async (req, res) => {
    const { name, description, expiryDate, category, location, locationLink, sellerId } = req.body;
    // Sanitizing numeric inputs
    const price = req.body.price === '' ? null : req.body.price;
    const originalPrice = req.body.originalPrice === '' ? null : req.body.originalPrice;
    const latitude = req.body.latitude === '' ? null : req.body.latitude;
    const longitude = req.body.longitude === '' ? null : req.body.longitude;
    let imageUrl = req.body.imageUrl; // Keep fallback if provided

    if (req.file) {
        // Assuming the server is accessed via proxy /api, but images via /uploads
        // We need to return a path relative to the domain root or full URL
        // Since we serve static /uploads, the path is /uploads/filename
        imageUrl = `/uploads/${req.file.filename}`;
    }

    try {
        const newItem = await query(
            `INSERT INTO items (name, description, price, original_price, expiry_date, category, location, location_link, latitude, longitude, seller_id, image_url)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
             RETURNING *`,
            [name, description, price, originalPrice, expiryDate, category, location, locationLink, latitude, longitude, sellerId, imageUrl]
        );
        res.status(201).json({ message: 'Item created successfully', item: newItem.rows[0] });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// Get Items Route (with optional location filtering)
app.get('/api/items', async (req, res) => {
    const { lat, lng } = req.query;

    try {
        let items;
        if (lat && lng) {
            // Haversine formula for distance
            const queryText = `
                SELECT *,
                (
                    6371 * acos(
                        cos(radians($1)) * cos(radians(latitude)) * cos(radians(longitude) - radians($2)) +
                        sin(radians($1)) * sin(radians(latitude))
                    )
                ) AS distance
                FROM items
                ORDER BY distance ASC
            `;
            items = await query(queryText, [lat, lng]);
        } else if (req.query.sellerId) {
             items = await query('SELECT * FROM items WHERE seller_id = $1 ORDER BY created_at DESC', [req.query.sellerId]);
        } else {
             items = await query('SELECT * FROM items ORDER BY created_at DESC');
        }
        res.json(items.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// Get Single Item Route
app.get('/api/items/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const item = await query('SELECT items.*, users.name as seller_name FROM items JOIN users ON items.seller_id = users.id WHERE items.id = $1', [id]);
        if (item.rows.length === 0) {
            return res.status(404).json({ message: 'Item not found' });
        }
        res.json(item.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// Get User Details (Public Profile)
app.get('/api/users/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const result = await query('SELECT id, name, email, phone, created_at FROM users WHERE id = $1', [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'User not found' });
        }
        res.json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// Update Item Route
app.put('/api/items/:id', async (req, res) => {
    const { id } = req.params;
    const { name, description, price, originalPrice, expiryDate, category, location, locationLink, imageUrl } = req.body;

    try {
        const result = await query(
            'UPDATE items SET name=$1, description=$2, price=$3, original_price=$4, expiry_date=$5, category=$6, location=$7, location_link=$8, image_url=$9 WHERE id=$10',
            [name, description, price, originalPrice, expiryDate, category, location, locationLink, imageUrl, id]
        );
        if (result.rowCount === 0) {
            return res.status(404).json({ message: 'Item not found' });
        }
        res.json({ message: 'Item updated successfully', item: result.rows[0] });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// Update User Route
app.put('/api/users/:id', async (req, res) => {
    const { id } = req.params;
    const { phone } = req.body;

    try {
        const result = await query(
            'UPDATE users SET phone = $1 WHERE id = $2 RETURNING id, name, email, phone, google_id, created_at',
            [phone, id]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'User not found' });
        }
        res.json({ message: 'User updated successfully', user: result.rows[0] });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// Delete Item Route
app.delete('/api/items/:id', async (req, res) => {
    const { id } = req.params;
    console.log(`[DELETE] Request for item ID: ${id}`);
    try {
        const result = await query('DELETE FROM items WHERE id = $1', [id]);
        if (result.rowCount === 0) {
            console.log(`[DELETE] Item ${id} not found`);
            return res.status(404).json({ message: 'Item not found' });
        }
        console.log(`[DELETE] Item ${id} deleted successfully`);
        res.json({ message: 'Item deleted successfully' });
    } catch (err) {
        console.error('[DELETE] Error:', err);
        res.status(500).json({ message: 'Server error' });
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

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
