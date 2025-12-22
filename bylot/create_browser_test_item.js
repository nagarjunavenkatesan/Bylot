
const API_URL = 'http://localhost:4173/api';

async function run() {
    try {
        const sellerId = 3; // Admin

        const formData = new FormData();
        formData.append('name', 'Browser Delete Test');
        formData.append('description', 'Target for browser click test');
        formData.append('price', '123');
        formData.append('sellerId', sellerId);
        formData.append('category', 'Other');
        formData.append('expiryDate', '2025-12-31');
        formData.append('location', 'Test Loc');

        const createRes = await fetch(`${API_URL}/items`, {
            method: 'POST',
            body: formData
        });
        
        if (createRes.ok) {
            const data = await createRes.json();
            console.log(`Created Item ID: ${data.item.id}`);
        } else {
            console.log('Failed to create item', createRes.status);
        }

    } catch (err) {
        console.error(err);
    }
}

run();
