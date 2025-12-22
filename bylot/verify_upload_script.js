
import { openAsBlob } from 'node:fs';
import { writeFile } from 'node:fs/promises';

// Create a dummy image file
await writeFile('test_image.txt', 'This is a test image content');

const API_URL = 'http://localhost:5000/api';

async function run() {
    try {
        // 1. Register
        const email = `test${Date.now()}@example.com`;
        const registerRes = await fetch(`${API_URL}/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: 'Test Uploader',
                email,
                phone: '1234567890',
                password: 'password'
            })
        });
        const registerData = await registerRes.json();
        if (!registerRes.ok) throw new Error(`Register failed: ${JSON.stringify(registerData)}`);
        console.log('Registered user:', registerData.user.id);
        const userId = registerData.user.id;

        // 2. Upload Item
        const formData = new FormData();
        formData.append('name', 'Test Item with Image');
        formData.append('description', 'Description');
        formData.append('price', '100');
        formData.append('sellerId', userId);
        formData.append('category', 'Vegetables');
        formData.append('expiryDate', '2025-12-31');
        
        const file = await openAsBlob('test_image.txt');
        formData.append('image', file, 'test_image.txt');

        const uploadRes = await fetch(`${API_URL}/items`, {
            method: 'POST',
            body: formData
        });
        
        const itemData = await uploadRes.json();
        if (!uploadRes.ok) throw new Error(`Upload failed: ${JSON.stringify(itemData)}`);
        
        console.log('Item created:', itemData.item);
        
        if (itemData.item.image_url && itemData.item.image_url.startsWith('/uploads/')) {
            console.log('SUCCESS: Image URL is correct:', itemData.item.image_url);
        } else {
            console.error('FAILURE: Image URL format incorrect:', itemData.item.image_url);
            process.exit(1);
        }

    } catch (err) {
        console.error('Error:', err);
        process.exit(1);
    }
}

run();
