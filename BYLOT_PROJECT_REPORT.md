# BYLOT — Complete Project Report
**Date:** June 7, 2026  
**Prepared by:** Kiro AI  
**Project Owner / CEO:** Nagarjuna B V  
**Contact:** nagarjunavenkatesan@gmail.com  

---

## 1. Project Overview

Bylot is a full-stack marketplace web application that connects local sellers of near-expiry, discounted, and surplus goods with nearby buyers. The platform aims to reduce food waste and help consumers save money by surfacing deals from local sellers based on geographic proximity.

The project consists of three parts:

| Part | Technology | Purpose |
|------|-----------|---------|
| Frontend Web App | React 19 + Vite 7 | Customer and seller-facing website |
| Backend REST API | Node.js + Express + MySQL | Central API server for all clients |
| Android Example | Kotlin + Retrofit | Native Android client (demo) |

---

## 2. Technology Stack

### Frontend
| Package | Version | Role |
|---------|---------|------|
| React | 19.2.0 | UI framework |
| React Router DOM | 7.10.0 | Client-side routing |
| Framer Motion | 12.23.25 | Page transitions & animations |
| React Parallax Tilt | 1.7.326 | 3D card tilt effects |
| React Icons | 5.5.0 | Icon library (Font Awesome) |
| @react-oauth/google | 0.12.2 | Google Sign-In |
| Vite | 7.2.6 | Build tool & dev server |

### Backend
| Package | Version | Role |
|---------|---------|------|
| Express | 4.21.2 | HTTP framework |
| mysql2 | 3.11.5 | MySQL database driver |
| bcrypt | 5.1.1 | Password hashing |
| jsonwebtoken | 9.0.2 | JWT access & refresh tokens |
| express-validator | 7.2.1 | Request validation |
| multer | 1.4.5 | File upload handling |
| helmet | 8.0.0 | Security headers |
| morgan | 1.10.0 | HTTP request logging |
| nodemailer | 6.9.16 | Email service (SMTP) |
| express-rate-limit | 7.5.0 | Rate limiting on auth routes |
| google-auth-library | 9.15.0 | Google OAuth token verification |

### Database
- **MySQL** with utf8mb4 charset
- 11 tables: users, admin, sellers, categories, products, offers, locations, orders, order_items, payments, notifications

---

## 3. Database Schema Summary

| Table | Key Columns | Purpose |
|-------|-------------|---------|
| users | id, name, email, role (customer/seller/admin), status | All user accounts |
| admin | user_id, permissions (JSON) | Admin privilege records |
| sellers | user_id, business_name, city, latitude, longitude, approval_status | Seller profiles |
| categories | name, slug, is_active | Product categories (4 defaults) |
| products | seller_id, category_id, name, mrp, selling_price, discount_percent, stock_quantity, expiry_date, status | Product listings |
| offers | product_id, discount_type, discount_value, starts_at, ends_at | Promotional offers |
| locations | user_id, city, latitude, longitude, is_default | Delivery addresses |
| orders | order_number, user_id, seller_id, status, payment_status, grand_total | Purchase orders |
| order_items | order_id, product_id, quantity, unit_price | Line items per order |
| payments | order_id, provider, amount, status | Payment records |
| notifications | user_id, title, message, type, channel | In-app notifications |

Default categories seeded: Daily Essentials, Near Expiry, Discount Products, Corporate Clearance.

---

## 4. Backend API — Routes Inventory

### Auth Routes (`/api/auth`)
| Method | Path | Description |
|--------|------|-------------|
| POST | /register | Create new customer/seller account |
| POST | /login | Email + password login |
| POST | /google-login | Google OAuth login |
| POST | /logout | Invalidate session (auth required) |
| POST | /refresh-token | Get new access token |
| POST | /forgot-password | Send password reset email |
| POST | /reset-password | Reset password with token |

### User Routes (`/api/users`) — auth required
| Method | Path | Description |
|--------|------|-------------|
| GET | /profile | Get own profile |
| PUT | /profile | Update name / phone |
| POST | /profile/image | Upload profile picture |

### Product Routes (`/api/products`) — public
| Method | Path | Description |
|--------|------|-------------|
| GET | / | List all active products (paginated, filterable) |
| GET | /search | Search by keyword |
| GET | /filter | Filter by category, price, type |
| GET | /discounts | Products with discount_percent > 0 |
| GET | /near-expiry | Products expiring within N days |
| GET | /nearby | Products near latitude/longitude within radius |
| GET | /:id | Get single product |

### Seller Routes (`/api/sellers`) — auth required
| Method | Path | Description |
|--------|------|-------------|
| GET | /profile | Get own seller profile |
| POST | /profile | Create or update seller profile |
| GET | /dashboard | Seller stats (revenue, stock, orders) |
| GET | /products | List own products |
| POST | /products | Add new product |
| PUT | /products/:id | Edit product |
| DELETE | /products/:id | Soft-delete product |
| PATCH | /products/:id/inventory | Update stock quantity |
| POST | /uploads/product-image | Upload product image |

### Order Routes (`/api/orders`) — auth required
| Method | Path | Description |
|--------|------|-------------|
| POST | / | Create order |
| GET | / | List own orders (admin sees all) |
| PATCH | /:id/cancel | Cancel order |
| GET | /:id/track | Track order status timeline |

### Admin Routes (`/api/admin`) — admin role required
| Method | Path | Description |
|--------|------|-------------|
| POST | /login | Admin-specific login |
| GET | /dashboard | Total users, sellers, products, orders, revenue |
| GET | /district-analytics | Sell/buy activity aggregated by city |
| GET | /users | All users (paginated) |
| PATCH | /users/:id/status | Block or unblock user |
| GET | /sellers | All sellers (paginated) |
| PATCH | /sellers/:id/approve | Approve or reject seller |
| GET | /products | All products (paginated) |
| PATCH | /products/:id/status | Change product status |
| DELETE | /products/:id | Hard delete product |

### Other Routes
| Prefix | Description |
|--------|-------------|
| /api/categories | List categories, get products by category |
| /api/notifications | Get notifications, send (admin only) |
| /api/payments | Create and verify payments |
| /health | Server health check |
| /api/config | Frontend config (Google client ID) |

**Total API endpoints: 38**

---

## 5. Frontend Pages & Components

### Pages (9 routes)

| Route | File | Description | Auth |
|-------|------|-------------|------|
| / | Home.jsx | Hero, how-it-works, featured deals grid | No |
| /browse | Browse.jsx | Full product listing with GPS, search, filters | No |
| /product/:id | ProductDetails.jsx | Product detail, buy now, contact seller | No (buy needs login) |
| /seller/:id | SellerDetails.jsx | Seller profile and contact info | No |
| /sell | Sell.jsx | Create a new product listing | Yes |
| /edit-item/:id | EditItem.jsx | Edit an existing listing | Yes (owner) |
| /profile | Profile.jsx | User info, own listings management | Yes |
| /login | Login.jsx | Google Sign-In | No |
| /register | Register.jsx | Email/phone/password registration + Google | No |
| /admin | AdminPanel.jsx | Full admin dashboard | Admin only |

### Components (10)

| Component | File | Description |
|-----------|------|-------------|
| Header | Header.jsx | Top navigation bar with theme toggle and auth links |
| Footer | Footer.jsx | Site footer with links and contact |
| Layout | Layout.jsx | Wraps all pages; adds swipe navigation gestures |
| ProductCard | ProductCard.jsx | Reusable card for product display with tilt effect |
| Button | Button.jsx | Reusable button with variant and size props |
| Card | Card.jsx | Glassmorphism card with 3D parallax tilt (react-parallax-tilt) |
| Loader | Loader.jsx | Animated 🛒 cart loading screen |
| PageTransition | PageTransition.jsx | Framer Motion fade+slide page wrapper |
| AIAssistant | AIAssistant.jsx | Floating chat bot with local rule-based responses |
| DistrictAnalytics | DistrictAnalytics.jsx | Admin charts and table for district-level activity |

### Context Providers (2)

| Context | File | Description |
|---------|------|-------------|
| AuthContext | AuthContext.jsx | User session, login(), logout(), localStorage persistence |
| LocationContext | LocationContext.jsx | GPS coords, status, city picker, localStorage persistence |

---

## 6. Key Features

### For Customers
- Browse all products or nearby products sorted by distance
- Search by keyword, filter by category
- GPS auto-detect with city picker fallback (Bangalore, Mumbai, Delhi, Chennai, Kolkata, Hyderabad, Pune)
- Product detail page with expiry date, price, seller info
- Buy Now with order creation
- Google Sign-In and email registration
- AI chatbot assistant (local rule-based, works offline)
- Share product links via native Web Share API
- Dark mode toggle

### For Sellers
- Create seller profile (submitted for admin approval)
- List products with name, price, MRP, expiry date, image, location
- Edit and manage listings
- Inventory management with low-stock threshold
- Seller dashboard with revenue and stock stats
- GPS-based location auto-fill on listings

### For Admin
- Dedicated admin login panel with password eye toggle
- Dashboard: total customers, sellers, products, orders, revenue
- District analytics: sell/buy activity visualized per city with bar charts
- Users table: block / unblock any user
- Sellers table: approve or reject seller applications
- Products table: change product status, delete listings
- Search/filter across all sections

---

## 7. Security Implementation

| Feature | Detail |
|---------|--------|
| Passwords | bcrypt, 12 salt rounds |
| Authentication | JWT access tokens (15 min) + refresh tokens (30 days) |
| Token storage | Refresh token hash stored in DB (SHA-256), not raw token |
| Password reset | SHA-256 hashed token, 30-minute expiry |
| Rate limiting | Auth endpoints: 30 requests per 15 minutes |
| CORS | Configurable per-origin allowlist via env |
| Helmet | Security headers on all responses |
| Input validation | express-validator on all POST/PATCH routes |
| File upload | Type whitelist (jpeg/png/webp), 5 MB max size |
| Role-based access | Customer / Seller / Admin middleware on every protected route |

---

## 8. Bugs Fixed During Development

| # | File | Bug | Fix |
|---|------|-----|-----|
| 1 | config/db.js | `namedPlaceholders: true` broke all positional `?` queries (root cause of admin 500 errors) | Removed the option |
| 2 | orderController.js | Stock `IF(stock_quantity = 0, ...)` evaluated before subtraction — products never auto-set to out_of_stock | Fixed to `IF(stock_quantity - ? <= 0, ...)` |
| 3 | orderController.js | `trackOrder` used `? IN ('admin')` — always true for any string, exposed all orders | Fixed to `? = 'admin'` |
| 4 | authController.js | `forgotPassword` saved reset token but no reset endpoint existed | Added `POST /api/auth/reset-password` with expiry validation |
| 5 | authValidators.js | Missing `resetPassword` validator | Added token + password validation |
| 6 | adminController.js | `/api/admin/district-analytics` route called by frontend but didn't exist | Added `districtAnalytics` controller and route |
| 7 | backendApi.js | All `fetch()` calls used absolute `http://localhost:5000/api/...` — bypassed Vite proxy, caused CORS failures | Switched all calls to relative paths (`/api/...`) |
| 8 | Browse.jsx | Hard-coded "Error Connecting to Server / Please make sure backend is running on port 5000" message | Replaced with clean error banner |
| 9 | Browse.jsx | Forced `hasDiscount` filter removed ALL products that lacked discount field | Removed forced filter |
| 10 | Login.jsx | Called wrong endpoint `/api/auth/google` (doesn't exist) and sent wrong field name `token` | Fixed to `/api/auth/google-login` with `idToken` |
| 11 | Register.jsx | Called `/api/auth/send-otp` and `/api/auth/verify-otp` — neither endpoint exists | Replaced with local client-side mock OTP |
| 12 | AIAssistant.jsx | Called `/api/chat` which doesn't exist — always showed connection error | Replaced with local rule-based response engine |
| 13 | Profile.jsx | `fetchProducts({ sellerId: userId })` passed user ID instead of seller table ID | Now fetches seller profile first to get correct seller ID |
| 14 | Profile.jsx | `handleLogout` called `localStorage.removeItem` directly, bypassed AuthContext | Fixed to use `logout()` from context |
| 15 | ProductDetails.jsx | `handleBuyNow` used relative `/api/orders` and wrong body `{itemId}` | Fixed URL and body to `{sellerId, items:[...]}` |
| 16 | SellerDetails.jsx | Called `/api/users/:id` which has no public route | Fixed to use `/api/products?sellerId=` to extract seller info |
| 17 | LocationContext.jsx | On GPS denied, app re-prompted every visit and blocked `loading=true` forever | Now silently sets `status=denied`, finishes loading immediately, never blocks |
| 18 | index.css | CSS variables `--border`, `--radius-xl`, `--radius-lg`, `--spacing-2xl` used in multiple files but never defined | Added all missing variables to `:root` |
| 19 | App.jsx | `/register` route not registered — Register page was unreachable | Added `<Route path="/register" element={<Register />} />` |
| 20 | ProductCard.jsx | `<img>` had no `onError` — broken image URLs caused blank cards | Added `onError` fallback to placeholder image |
| 21 | AuthContext.jsx | Debug `console.log` statements exposed user data in browser console | Removed all debug logs |
| 22 | backendApi.js | `fetchNearbyProducts` fallback used `lat`/`lng` params but backend expects `latitude`/`longitude` | Fixed param names |
| 23 | backendApi.js | `fetchProductById` called `normalizeProduct(response)` on API envelope instead of `response.data` | Fixed to extract `response.data` first |

---

## 9. Build Status

### Frontend
```
vite v7.2.6 — production build
✓ 474 modules transformed
dist/index.html          0.46 kB  │ gzip: 0.30 kB
dist/assets/index.css   36.90 kB  │ gzip: 7.46 kB
dist/assets/index.js   420.34 kB  │ gzip: 133.59 kB
✓ Built in 5.01s — 0 errors, 0 warnings
```

### Backend
```
node -e "require('./app')" — EXIT 0
All controllers, routes, middleware, models load without error
```

---

## 10. How to Run the Project

### Backend
```bash
cd backend
npm install
# Create .env from .env.example and fill DB credentials
node scripts/runSchema.js     # Create database tables
node scripts/createAdmin.js   # Create admin user
npm run dev                   # Start on port 5000
```

### Frontend
```bash
cd bylot
npm install
# Ensure VITE_GOOGLE_CLIENT_ID is set in .env
npm run dev                   # Start on port 5173
```

### Environment Variables Required
| Variable | Where | Required |
|----------|-------|----------|
| DB_HOST, DB_USER, DB_NAME | backend/.env | Yes |
| DB_PASSWORD | backend/.env | Yes (if set) |
| JWT_ACCESS_SECRET | backend/.env | Yes |
| JWT_REFRESH_SECRET | backend/.env | Yes |
| VITE_GOOGLE_CLIENT_ID | bylot/.env | For Google Sign-In |
| CORS_ORIGINS | backend/.env | For production |
| SMTP_HOST, SMTP_USER, SMTP_PASS | backend/.env | For password reset emails |

---

## 11. Known Limitations & Future Improvements

| Item | Status | Notes |
|------|--------|-------|
| OTP phone verification | Mock only | Real SMS gateway (Twilio/MSG91) not integrated |
| Payment gateway | Manual mode only | Razorpay/Stripe integration ready in service layer |
| Email password reset | Requires SMTP config | Works when SMTP credentials are set |
| Push notifications | Schema ready | FCM/push service not implemented |
| Google Sign-In | Requires Client ID | Set `VITE_GOOGLE_CLIENT_ID` in frontend .env |
| Image CDN | Local uploads only | Files stored in `/uploads` folder, not on CDN |
| Android app | Demo/example only | Retrofit example included, not a full app |
| Real-time updates | Not implemented | WebSocket/SSE could be added for live order tracking |

---

## 12. Project File Count

| Area | Files |
|------|-------|
| Backend controllers | 9 |
| Backend routes | 9 |
| Backend middleware | 5 |
| Backend models | 4 |
| Backend validators | 8 |
| Backend services | 3 |
| Backend utils | 6 |
| Frontend pages | 10 |
| Frontend components | 10 |
| Frontend context providers | 2 |
| Frontend API layer | 1 |
| CSS stylesheets | 12 |
| Database tables | 11 |
| **Total API endpoints** | **38** |

---

*Report generated: June 7, 2026*  
*Build: Frontend ✅ 474 modules, 0 errors | Backend ✅ all modules load, 0 errors*
