import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:5000/api';

async function testBackend() {
    console.log('Starting Backend Verification...');
    const phone = '9998887776';
    const email = `verify_${Date.now()}@example.com`;
    const password = 'password123';
    let otp = '';

    // 1. Send OTP
    try {
        console.log('\n1. Testing Send OTP...');
        const res = await fetch(`${BASE_URL}/auth/send-otp`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phone })
        });
        const data = await res.json();
        console.log('   Status:', res.status);
        if (data.otp) {
            otp = data.otp;
            console.log('   OTP Received:', otp);
        } else {
            throw new Error('OTP not received in response');
        }
    } catch (err) {
        console.error('   Failed:', err.message);
        process.exit(1);
    }

    // 2. Verify OTP
    try {
        console.log('\n2. Testing Verify OTP...');
        const res = await fetch(`${BASE_URL}/auth/verify-otp`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phone, otp })
        });
        const data = await res.json();
        console.log('   Status:', res.status);
        console.log('   Response:', data.message);
        if (!res.ok) throw new Error(data.message);
    } catch (err) {
        console.error('   Failed:', err.message);
        process.exit(1);
    }

    // 3. Register
    try {
        console.log('\n3. Testing Register...');
        const res = await fetch(`${BASE_URL}/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: 'Verification User',
                email,
                phone,
                password
            })
        });
        const data = await res.json();
        console.log('   Status:', res.status);
        console.log('   Response:', data.message);
        if (!res.ok) throw new Error(data.message);
    } catch (err) {
        console.error('   Failed:', err.message);
        process.exit(1);
    }

    // 4. Login
    try {
        console.log('\n4. Testing Login...');
        const res = await fetch(`${BASE_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        const data = await res.json();
        console.log('   Status:', res.status);
        if (data.user) {
            console.log('   Logged in User:', data.user.name);
        } else {
            throw new Error('Login failed');
        }
    } catch (err) {
        console.error('   Failed:', err.message);
        process.exit(1);
    }

    console.log('\nBackend Verification Complete! ALL TESTS PASSED.');
}

testBackend();
