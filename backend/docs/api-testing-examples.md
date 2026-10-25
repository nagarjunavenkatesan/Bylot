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

---

## Admin Two-Step Authentication (2FA)

Admin Password Login (Returns 2FA Challenge):

```bash
curl -X POST "$BASE_URL/api/admin/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@bylot.in","password":"AdminPass123!"}'
# Response: {"success":true,"message":"Two-step verification required","data":{"requires2FA":true,"challengeId":"<CHALLENGE_ID>","expiresIn":300}}
```

Admin 2FA Verification (Google Authenticator 6-digit TOTP):

```bash
curl -X POST "$BASE_URL/api/admin/2fa/verify-login" \
  -H "Content-Type: application/json" \
  -d '{"challengeId":"<CHALLENGE_ID>","code":"123456"}'
# Response: {"success":true,"message":"Admin login successful","data":{"accessToken":"...","user":{...}}}
```

Admin Emergency Recovery Code Login:

```bash
curl -X POST "$BASE_URL/api/admin/2fa/verify-recovery" \
  -H "Content-Type: application/json" \
  -d '{"challengeId":"<CHALLENGE_ID>","recoveryCode":"XXXX-XXXX"}'
# Response: {"success":true,"message":"Recovery code verified successfully","data":{"accessToken":"...","user":{...}}}
```

Admin 2FA Setup Initiation (Authenticated):

```bash
curl -X POST "$BASE_URL/api/admin/2fa/setup" \
  -H "Authorization: Bearer ADMIN_ACCESS_TOKEN"
# Returns challengeId, qrCodeUrl, manualKey, and provisioningUri
```

Admin 2FA Setup Verification:

```bash
curl -X POST "$BASE_URL/api/admin/2fa/verify-setup" \
  -H "Content-Type: application/json" \
  -d '{"challengeId":"<SETUP_CHALLENGE_ID>","code":"123456"}'
# Response returns accessToken and 10 single-use recovery codes
```

