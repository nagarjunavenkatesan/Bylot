# API Testing Examples

Set a base URL:

```bash
BASE_URL=https://localhost:5000
```

Register:

```bash
curl -X POST "$BASE_URL/api/auth/register" \
  -H "Content-Type: application/json" \
  -d '{"name":"Demo Customer","email":"customer@example.com","password":"Password123","role":"customer"}'
```

Login:

```bash
curl -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"customer@example.com","password":"Password123"}'
```

Get products:

```bash
curl "$BASE_URL/api/products?page=1&limit=20"
```

Create seller profile:

```bash
curl -X POST "$BASE_URL/api/sellers/profile" \
  -H "Authorization: Bearer ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"businessName":"Bylot Demo Store","businessType":"mixed","city":"Bengaluru","state":"Karnataka","postalCode":"560001","latitude":12.9716,"longitude":77.5946}'
```

Approve seller as admin:

```bash
curl -X PATCH "$BASE_URL/api/admin/sellers/1/approve" \
  -H "Authorization: Bearer ADMIN_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"approvalStatus":"approved"}'
```

Add product:

```bash
curl -X POST "$BASE_URL/api/sellers/products" \
  -H "Authorization: Bearer SELLER_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"categoryId":1,"name":"Discount Rice Pack","mrp":250,"sellingPrice":199,"stockQuantity":50,"productType":"discount"}'
```

Create order:

```bash
curl -X POST "$BASE_URL/api/orders" \
  -H "Authorization: Bearer ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"sellerId":1,"items":[{"productId":1,"quantity":2}]}'
```

