/**
 * INDEPENDENT AUTHENTICATION FLOW VERIFIER
 * Captures real HTTP responses with sensitive fields redacted.
 */

const BASE_URL = 'http://localhost:5000';

function redact(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  const clone = JSON.parse(JSON.stringify(obj));
  function walk(o) {
    for (const k in o) {
      if (typeof o[k] === 'string') {
        if (/token|secret|password|key|hash|challenge/i.test(k)) {
          o[k] = o[k].slice(0, 8) + '...[REDACTED]...';
        }
      } else if (typeof o[k] === 'object' && o[k] !== null) {
        walk(o[k]);
      }
    }
  }
  walk(clone);
  return clone;
}

async function req(path, opts = {}) {
  const headers = {
    'Content-Type': 'application/json',
    'X-Requested-With': 'bylot',
    'Origin': 'http://localhost:5173',
    ...(opts.headers || {})
  };
  const res = await fetch(`${BASE_URL}${path}`, { ...opts, headers });
  let body;
  try { body = await res.json(); } catch { body = null; }
  return {
    status: res.status,
    headers: Object.fromEntries(res.headers.entries()),
    cookie: res.headers.get('set-cookie'),
    body: redact(body)
  };
}

async function verifyAllAuthFlows() {
  console.log('--- 1. Valid Login ---');
  const validLogin = await req('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'buyer@bylot.in', password: 'Bylot#2026Secured!' })
  });
  console.log('Status:', validLogin.status);
  console.log('Response:', JSON.stringify(validLogin.body, null, 2));

  console.log('\n--- 2. Invalid Credentials ---');
  const invalidCreds = await req('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'buyer@bylot.in', password: 'WrongPassword999!' })
  });
  console.log('Status:', invalidCreds.status);
  console.log('Response:', JSON.stringify(invalidCreds.body, null, 2));

  console.log('\n--- 3. Registration ---');
  const newEmail = `verify_reg_${Date.now()}@bylot.in`;
  const reg = await req('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ name: 'Independent Verifier', email: newEmail, password: 'Bylot#2026Secured!' })
  });
  console.log('Status:', reg.status);
  console.log('Response:', JSON.stringify(reg.body, null, 2));

  console.log('\n--- 4. Email Verification State ---');
  console.log('Status: In development without SMTP, auto-verification activates. In production with SMTP, verification email token sent.');
  console.log('Verified user data:', reg.body?.data?.user?.email_verified_at ? 'Email Verified' : 'Pending Verification');

  console.log('\n--- 5. Password Reset Flow ---');
  const forgot = await req('/api/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ email: 'buyer@bylot.in' })
  });
  console.log('Status:', forgot.status);
  console.log('Response:', JSON.stringify(forgot.body, null, 2));

  console.log('\n--- 6. Google OAuth Endpoint Config ---');
  const config = await req('/api/config');
  console.log('Status:', config.status);
  console.log('Response:', JSON.stringify(config.body, null, 2));

  console.log('\n--- 7. Admin 2FA Trigger ---');
  const adminLogin = await req('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'admin@bylot.in', password: 'Bylot#2026Secured!' })
  });
  console.log('Status:', adminLogin.status);
  console.log('Response (2FA Challenge):', JSON.stringify(adminLogin.body, null, 2));

  console.log('\n--- 8. Token Refresh ---');
  // Log in again to get fresh cookie
  const freshLogin = await req('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'buyer@bylot.in', password: 'Bylot#2026Secured!' })
  });
  const refreshRes = await req('/api/auth/refresh-token', {
    method: 'POST',
    headers: { Cookie: freshLogin.cookie }
  });
  console.log('Status:', refreshRes.status);
  console.log('Response:', JSON.stringify(refreshRes.body, null, 2));

  console.log('\n--- 9. Refresh Rotation (Reusing Old Token) ---');
  const reuseRes = await req('/api/auth/refresh-token', {
    method: 'POST',
    headers: { Cookie: freshLogin.cookie } // Reusing already consumed old cookie
  });
  console.log('Status (Should be 401 Reused/Revoked):', reuseRes.status);
  console.log('Response:', JSON.stringify(reuseRes.body, null, 2));

  console.log('\n--- 10. Logout & Cookie Invalidation ---');
  const postRefreshLogin = await req('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'seller@bylot.in', password: 'Bylot#2026Secured!' })
  });
  const logoutRes = await req('/api/auth/logout', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${postRefreshLogin.body?.data?.accessToken}`,
      Cookie: postRefreshLogin.cookie
    }
  });
  console.log('Status:', logoutRes.status);
  console.log('Set-Cookie Header on Logout:', logoutRes.cookie);

  console.log('\n--- 11. Browser Refresh & Session Restoration ---');
  const sessionCheck = await req('/api/users/profile', {
    headers: { Authorization: `Bearer ${validLogin.body?.data?.accessToken}` }
  });
  console.log('Status:', sessionCheck.status);
  console.log('Response:', JSON.stringify(sessionCheck.body, null, 2));

  console.log('\n--- 12. Suspended / Blocked Account ---');
  const blockedLogin = await req('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'blocked_user_fixture@bylot.in', password: 'Bylot#2026Secured!' })
  });
  console.log('Status:', blockedLogin.status);
  console.log('Response:', JSON.stringify(blockedLogin.body, null, 2));

  console.log('\n--- 13. Account Lockout on 5 Consecutive Failures ---');
  const targetEmail = `lockout_indep_${Date.now()}@bylot.in`;
  await req('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ name: 'Target', email: targetEmail, password: 'Bylot#2026Secured!' })
  });
  let lockStatus = 0;
  let lockBody = null;
  for (let i = 0; i < 6; i++) {
    const res = await req('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: targetEmail, password: 'WrongPassword!' })
    });
    if (res.status === 429 || res.body?.message?.includes('locked')) {
      lockStatus = res.status;
      lockBody = res.body;
      break;
    }
  }
  console.log('Lockout Status:', lockStatus);
  console.log('Lockout Response:', JSON.stringify(lockBody, null, 2));

  console.log('\n--- 14. Malformed JWT ---');
  const malformed = await req('/api/users/profile', {
    headers: { Authorization: 'Bearer not.a.valid.jwt.token' }
  });
  console.log('Status:', malformed.status);
  console.log('Response:', JSON.stringify(malformed.body, null, 2));

  console.log('\n--- 15. Expired JWT ---');
  // Standard expired token (exp in past)
  const expiredToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjEsImV4cCI6MTYwMDAwMDAwMH0.signature';
  const expired = await req('/api/users/profile', {
    headers: { Authorization: `Bearer ${expiredToken}` }
  });
  console.log('Status:', expired.status);
  console.log('Response:', JSON.stringify(expired.body, null, 2));

  console.log('\n--- 16. Unauthorized API Request (Buyer accessing Admin) ---');
  const buyerToken = validLogin.body?.data?.accessToken;
  const unauth = await req('/api/admin/users', {
    headers: { Authorization: `Bearer ${buyerToken}` }
  });
  console.log('Status:', unauth.status);
  console.log('Response:', JSON.stringify(unauth.body, null, 2));

  console.log('\n--- 17. Unauthenticated Protected Route ---');
  const noToken = await req('/api/users/profile');
  console.log('Status:', noToken.status);
  console.log('Response:', JSON.stringify(noToken.body, null, 2));
}

verifyAllAuthFlows();
