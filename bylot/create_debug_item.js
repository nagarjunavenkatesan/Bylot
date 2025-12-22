const API_URL = 'http://localhost:5000/api';
import FormData from 'form-data';
import fs from 'fs';
import path from 'path';
import fetch from 'node-fetch';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create a dummy image for testing
const dummyImagePath = path.join(__dirname, 'test_image.jpg');
if (!fs.existsSync(dummyImagePath)) {
    fs.writeFileSync(dummyImagePath, 'dummy content');
}

async function testCreateItem() {
    const form = new FormData();
    form.append('name', 'Test Item');
    form.append('description', 'Test Description');
    form.append('price', '10');
    form.append('originalPrice', '20');
    form.append('expiryDate', '2025-01-01');
    form.append('category', 'Vegetables');
    form.append('location', 'Test Location');
    form.append('locationLink', 'http://maps.google.com');
    form.append('sellerId', '3'); // Assuming ID 3 exists (admin user)
    form.append('image', fs.createReadStream(dummyImagePath));

    try {
        const response = await fetch(`${API_URL}/items`, {
            method: 'POST',
            body: form
        });

        console.log('Status:', response.status);
        const text = await response.text();
        console.log('Response:', text);
    } catch (error) {
        console.error('Error:', error);
    }
}

testCreateItem();
