import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:5000/api';

async function testFullFeatures() {
    console.log('Starting Full Feature Verification (Auth + Items CRUD)...');
    const phone = '9991112223';
    const email = `verify_full_${Date.now()}@example.com`;
    const password = 'password123';
    let userId = null;
    let itemId = null;

    // --- AUTH SECTION ---
    
    // Register
    try {
        console.log('\n1. Testing Register...');
        const res = await fetch(`${BASE_URL}/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: 'Full Test User',
                email,
                phone,
                password
            })
        });
        const data = await res.json();
        console.log('   Status:', res.status);
        if (!res.ok) throw new Error(data.message);
        userId = data.user.id;
        console.log('   User ID:', userId);
    } catch (err) {
        console.error('   Failed:', err.message);
        process.exit(1);
    }

    // Login
    try {
        console.log('\n2. Testing Login...');
        const res = await fetch(`${BASE_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        const data = await res.json();
        console.log('   Status:', res.status);
        if (!res.ok) throw new Error(data.message);
        if (data.user.id !== userId) console.warn('   UserId mismatch warning');
    } catch (err) {
        console.error('   Failed:', err.message);
        process.exit(1);
    }

    // --- ITEM SECTION ---

    // Create Item
    try {
        console.log('\n3. Testing Create Item...');
        const itemData = {
            name: 'Test Item',
            description: 'A test item description',
            price: 100,
            originalPrice: 120,
            expiryDate: new Date(Date.now() + 86400000).toISOString(),
            category: 'Vegetables',
            location: '123 Test Lane',
            locationLink: 'http://maps.google.com',
            latitude: 12,
            longitude: 77,
            sellerId: userId,
            imageUrl: 'http://example.com/img.jpg'
        };

        const res = await fetch(`${BASE_URL}/items`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(itemData)
        });
        const data = await res.json();
        console.log('   Status:', res.status);
        if (!res.ok) throw new Error(data.message);
        itemId = data.item.id;
        console.log('   Item Created with ID:', itemId);
    } catch (err) {
        console.error('   Failed:', err.message);
        process.exit(1);
    }

    // Verify Item Exists AND Check Edit Feasibility
    try {
        console.log('\n4. Verifying Item Fetch...');
        const res = await fetch(`${BASE_URL}/items/${itemId}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.message);
        if (data.name !== 'Test Item') throw new Error('Item name mismatch');
        console.log('   Item Fetched Successfully');
    } catch (err) {
        console.error('   Failed:', err.message);
        process.exit(1);
    }

    // Update Item (Edit Feature)
    try {
        console.log('\n5. Testing Update Item (Edit Feature)...');
        const updateData = {
            name: 'Updated Test Item',
            description: 'Updated description',
            price: 150,
            originalPrice: 180,
            expiryDate: new Date(Date.now() + 172800000).toISOString(),
            category: 'Fruits',
            location: '456 Updated Lane',
            locationLink: 'http://maps.google.com/updated',
            imageUrl: 'http://example.com/img_updated.jpg'
        };

        const res = await fetch(`${BASE_URL}/items/${itemId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updateData)
        });
        const data = await res.json();
        console.log('   Status:', res.status);
        if (!res.ok) throw new Error(data.message);
        
        // Verify update
        if (data.item.name !== 'Updated Test Item') throw new Error('Update verification failed in response');
        console.log('   Item Updated Successfully');
    } catch (err) {
        console.error('   Failed:', err.message);
        process.exit(1);
    }

    // Delete Item (Delete Feature)
    try {
        console.log('\n6. Testing Delete Item...');
        const res = await fetch(`${BASE_URL}/items/${itemId}`, {
            method: 'DELETE'
        });
        console.log('   Status:', res.status);
        if (!res.ok) throw new Error('Delete failed');
        console.log('   Item Deleted Successfully');
    } catch (err) {
        console.error('   Failed:', err.message);
        process.exit(1);
    }

    // Verify Deletion (Should 404)
    try {
        console.log('\n7. Verifying Deletion...');
        const res = await fetch(`${BASE_URL}/items/${itemId}`);
        if (res.status === 404) {
             console.log('   Confirmed: Item not found (404) as expected.');
        } else {
             throw new Error(`Expected 404 but got ${res.status}`);
        }
    } catch (err) {
        console.error('   Failed:', err.message);
        process.exit(1);
    }

    console.log('\nFULL FEATURE VERIFICATION COMPLETE: ALL TESTS PASSED.');
}

testFullFeatures();
