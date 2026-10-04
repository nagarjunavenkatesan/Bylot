# Bylot Backend

Production-ready centralized REST API for the Bylot Android app, website app, and admin panel.

## Stack

- Node.js
- Express.js
- MySQL with `mysql2`
- JWT access and refresh tokens
- bcrypt password hashing
- Google Sign-In ID token verification
- Role-based authorization: `customer`, `seller`, `admin`

## Setup

```bash
cd backend
npm install
cp .env.example .env
```

Update `.env` with your MySQL credentials and secrets, then create the database:

```bash
npm run schema
```

Start the API:

```bash
npm run dev
```

Create an admin user:

```powershell
$env:ADMIN_EMAIL="admin@bylot.com"; $env:ADMIN_PASSWORD="Password123"; npm run create-admin
```

The API will be available at:

```text
https://localhost:5000
```

Health check:

```http
GET /health
```

## Response Format

Every successful API response follows this Android Retrofit and React-friendly shape:

```json
{
  "success": true,
  "message": "Products fetched successfully",
  "data": []
}
```

Paginated responses include `meta`:

```json
{
  "success": true,
  "message": "Products fetched successfully",
  "data": [],
  "meta": {
    "total": 100,
    "page": 1,
    "limit": 20,
    "totalPages": 5
  }
}
```

## API Routes

### Auth

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/google-login`
- `POST /api/auth/logout`
- `POST /api/auth/refresh-token`
- `POST /api/auth/forgot-password`

### Users

- `GET /api/users/profile`
- `PUT /api/users/profile`
- `POST /api/users/profile/image`

### Products

- `GET /api/products`
- `GET /api/products/:id`
- `GET /api/products/search?q=rice`
- `GET /api/products/filter?categoryId=1&minPrice=10&maxPrice=100`
- `GET /api/products/discounts`
- `GET /api/products/near-expiry?days=30`
- `GET /api/products/nearby?latitude=12.9716&longitude=77.5946&radiusKm=10`

### Sellers

- `POST /api/sellers/profile`
- `GET /api/sellers/profile`
- `GET /api/sellers/dashboard`
- `GET /api/sellers/products`
- `POST /api/sellers/uploads/product-image`
- `POST /api/sellers/products`
- `PUT /api/sellers/products/:id`
- `DELETE /api/sellers/products/:id`
- `PATCH /api/sellers/products/:id/inventory`

### Orders

- `POST /api/orders`
- `GET /api/orders`
- `PATCH /api/orders/:id/cancel`
- `GET /api/orders/:id/track`

### Categories

- `GET /api/categories`
- `GET /api/categories/:id/products`

### Notifications

- `GET /api/notifications`
- `POST /api/notifications`

### Admin

- `POST /api/admin/login`
- `GET /api/admin/users`
- `GET /api/admin/sellers`
- `PATCH /api/admin/sellers/:id/approve`
- `PATCH /api/admin/users/:id/status`
- `GET /api/admin/dashboard`
- `GET /api/admin/products`
- `PATCH /api/admin/products/:id/status`

## Auth Header

Send the access token from login/register/google-login:

```http
Authorization: Bearer ACCESS_TOKEN_HERE
```

## Uploads

Profile image:

```bash
curl -X POST https://localhost:5000/api/users/profile/image \
  -H "Authorization: Bearer ACCESS_TOKEN" \
  -F "profileImage=@avatar.png"
```

Product image:

```bash
curl -X POST https://localhost:5000/api/sellers/uploads/product-image \
  -H "Authorization: Bearer ACCESS_TOKEN" \
  -F "productImage=@product.png"
```

## Production Notes

- Put the API behind HTTPS at the reverse proxy or load balancer.
- Use long random JWT secrets and rotate them through your secret manager.
- Restrict `CORS_ORIGINS` to approved Android/web/admin origins.
- Store uploaded files on object storage such as S3 in production if multiple API instances are used.
- Run MySQL backups and migrations through your deployment pipeline.
