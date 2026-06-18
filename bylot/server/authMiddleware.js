import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'bylot_super_secret_key_12345';

export const requireAuth = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: 'Unauthorized: No token provided' });
    }
    
    const token = authHeader.split(' ')[1];
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded; // { id, role, ... }
        next();
    } catch (err) {
        console.error('[AUTH_TOKEN_ERROR]', err);
        return res.status(401).json({ message: 'Unauthorized: Invalid token', errorId: 'ERR_AUTH_TOKEN_401' });
    }
};

export const requireAdmin = (req, res, next) => {
    // Must be preceded by requireAuth
    if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Forbidden: Admin access required' });
    }
    next();
};

export const signToken = (user) => {
    return jwt.sign(
        { id: user.id, role: user.role || 'user' },
        JWT_SECRET,
        { expiresIn: '7d' } // Token valid for 7 days
    );
};
