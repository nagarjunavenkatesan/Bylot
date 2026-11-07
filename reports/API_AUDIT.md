# BYLOT — BACKEND API AUDIT & ENDPOINT INVENTORY

**Project:** Bylot Hyperlocal Marketplace  
**Base URL:** `https://bylot.in/api`  
**API Standard:** RESTful JSON  
**Compatibility:** React Web Application & Android Retrofit 2 Client  

---

## 1. ENDPOINT INVENTORY & ACCESS CONTROL

### 1.1 Authentication & Profile (`/api/auth`, `/api/users`)
| Method | Endpoint | Protection | Description | Verified |
|---|---|---|---|---|
| `POST` | `/api/auth/register` | Rate Limited (Public) | User account registration | **PASS (201)** |
| `POST` | `/api/auth/login` | Rate Limited + Lockout | Email/password login | **PASS (200)** |
| `POST` | `/api/auth/refresh-token` | CSRF + HttpOnly Cookie | Rotate & issue new JWT access token | **PASS (200)** |
| `POST` | `/api/auth/logout` | Authenticated + CSRF | Invalidate session & clear cookies | **PASS (200)** |
| `POST` | `/api/auth/forgot-password` | Rate Limited (Public) | Request password reset token | **PASS (200)** |
| `POST` | `/api/auth/reset-password` | Rate Limited (Public) | Reset password with token | **PASS (200)** |
| `POST` | `/api/auth/verify-email` | Rate Limited (Public) | Verify email address | **PASS (200)** |
| `GET` | `/api/users/profile` | Authenticated (Any Role) | Fetch authenticated user details | **PASS (200)** |
| `PUT` | `/api/users/profile` | Authenticated (Any Role) | Update profile details | **PASS (200)** |

### 1.2 Catalog & Deals (`/api/products`, `/api/categories`, `/api/locations`)
| Method | Endpoint | Protection | Description | Verified |
|---|---|---|---|---|
| `GET` | `/api/products` | Public (Cached) | Fetch product catalog with filters | **PASS (200)** |
| `GET` | `/api/products/:id` | Public | Fetch product details by ID | **PASS (200)** |
| `GET` | `/api/categories` | Public (Cached) | List all active product categories | **PASS (200)** |
| `GET` | `/api/locations/states` | Public (Cached) | List supported Indian states | **PASS (200)** |
| `GET` | `/api/locations/states/:code/districts` | Public (Cached) | List districts for state code | **PASS (200)** |

### 1.3 Seller Operations (`/api/sellers`)
| Method | Endpoint | Protection | Description | Verified |
|---|---|---|---|---|
| `GET` | `/api/sellers/profile` | Authenticated (Seller/Admin) | Get seller store details | **PASS (200)** |
| `GET` | `/api/sellers/products` | Authenticated (Seller) | List seller's own listings | **PASS (200)** |
| `POST` | `/api/sellers/products` | Authenticated (Seller) | Create a new product listing | **PASS (201)** |
| `PUT` | `/api/sellers/products/:id` | Authenticated (Seller IDOR) | Update product details | **PASS (200)** |
| `DELETE`| `/api/sellers/products/:id` | Authenticated (Seller IDOR) | Soft-delete product listing | **PASS (200)** |
| `POST` | `/api/sellers/uploads/product-image`| Authenticated (Seller) | Upload product images (max 5MB) | **PASS (201)** |
| `GET` | `/api/sellers/orders` | Authenticated (Seller) | List orders placed with seller | **PASS (200)** |
| `PATCH`| `/api/sellers/orders/:id/status`| Authenticated (Seller) | Update order status | **PASS (200)** |

### 1.4 Admin & Governance (`/api/admin`)
| Method | Endpoint | Protection | Description | Verified |
|---|---|---|---|---|
| `GET` | `/api/admin/users` | Authenticated (Admin + 2FA) | List all registered users | **PASS (200)** |
| `PATCH`| `/api/admin/users/:id/status` | Authenticated (Admin + 2FA) | Block/unblock user account | **PASS (200)** |
| `GET` | `/api/admin/sellers` | Authenticated (Admin + 2FA) | List seller approval requests | **PASS (200)** |
| `PATCH`| `/api/admin/sellers/:id/approve`| Authenticated (Admin + 2FA) | Approve/reject seller status | **PASS (200)** |
| `GET` | `/api/admin/products/expired`| Authenticated (Admin + 2FA) | List expired products | **PASS (200)** |
| `DELETE`| `/api/admin/products/expired`| Authenticated (Admin + 2FA) | Bulk cleanup expired products | **PASS (200)** |
| `GET` | `/api/admin/archives` | Authenticated (Admin + 2FA) | List encrypted report archives | **PASS (200)** |
| `GET` | `/api/admin/2fa/status` | Authenticated (Admin) | Check admin 2FA status | **PASS (200)** |
| `POST` | `/api/admin/2fa/verify-login` | Public (Challenge Guard) | Verify TOTP code during login | **PASS (200)** |

---

## 2. API CONTRACT CONSISTENCY & ANDROID COMPATIBILITY

- **Shared Backend:** Both the React web application and the Android Kotlin Retrofit application communicate with the same Express endpoints.
- **Header Bypass:** Mobile clients pass `X-Client-Platform: android`, safely bypassing browser-only ambient cookie CSRF checks.
- **DTO Synchronization:** Product model fields (`id`, `title`, `mrp`, `selling_price`, `expiry_date`, `image_url`) match Android `ProductDto.kt` properties exactly.
