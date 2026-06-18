import fetch from 'node-fetch';

const BASE = 'http://localhost:5000';

async function test(name, fn) {
    try {
        await fn();
        console.log(`PASS: ${name}`);
    } catch (err) {
        console.error(`FAIL: ${name} -> ${err.message}`);
        process.exitCode = 1;
    }
}

async function run() {
    let token = '';

    await test('admin login', async () => {
        const res = await fetch(`${BASE}/api/admin/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: 'nagarjunavenkatesan@gmail.com',
                password: '@bvnd4014BV',
            }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || res.status);
        token = data.data?.accessToken;
        if (!token) throw new Error('No access token returned');
    });

    const authHeaders = { Authorization: `Bearer ${token}` };

    for (const path of [
        '/api/admin/dashboard',
        '/api/admin/district-analytics',
        '/api/admin/users?limit=50',
        '/api/admin/sellers?limit=50',
        '/api/admin/products?limit=50',
    ]) {
        await test(path, async () => {
            const res = await fetch(`${BASE}${path}`, { headers: authHeaders });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.message || `HTTP ${res.status}`);
            console.log(`  -> ${path} OK`);
        });
    }
}

run();
