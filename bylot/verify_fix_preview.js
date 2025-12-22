
import { openAsBlob } from 'node:fs';
import { writeFile } from 'node:fs/promises';

// Create a dummy image file if not exists
await writeFile('test_image_fix.txt', 'Test fix content');

const PREVIEW_URL = 'http://localhost:4173/api';

async function run() {
    try {
        console.log("Testing Create Listing fix on Preview (Port 4173)...");
        
        // 1. We accept that we need a sellerId. Use 1 (from previous tests)
        const sellerId = 1;

        // 2. Upload Item with EMPTY strings for numeric fields
        const formData = new FormData();
        formData.append('name', 'Preview Fix Test Item');
        formData.append('description', 'Testing empty strings fix');
        formData.append('price', '99');
        formData.append('originalPrice', ''); // EMPTY STRING - previously caused error
        formData.append('sellerId', sellerId);
        formData.append('category', 'Fruits');
        formData.append('expiryDate', '2025-12-31');
        formData.append('location', 'Test Location');
        formData.append('latitude', ''); // EMPTY STRING
        formData.append('longitude', ''); // EMPTY STRING
        
        const file = await openAsBlob('test_image_fix.txt');
        formData.append('image', file, 'test_image_fix.txt');

        const uploadRes = await fetch(`${PREVIEW_URL}/items`, {
            method: 'POST',
            body: formData
        });
        
        const text = await uploadRes.text();
        let itemData;
        try {
            itemData = JSON.parse(text);
        } catch (e) {
            console.error('Failed to parse JSON:', text);
            throw new Error(`Invalid JSON response: ${text}`);
        }

        if (!uploadRes.ok) {
            throw new Error(`Upload failed with status ${uploadRes.status}: ${JSON.stringify(itemData)}`);
        }
        
        console.log('SUCCESS: Item created successfully despite empty numeric fields!');
        console.log('Item ID:', itemData.item.id);
        console.log('Image URL:', itemData.item.image_url);

    } catch (err) {
        console.error('FAILURE:', err.message);
        process.exit(1);
    }
}

run();
