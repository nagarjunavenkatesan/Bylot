
const API_URL = 'http://localhost:4173/api';

async function run() {
    try {
        // First login to get ID?
        // Or assume ID 3 based on previous logs ("Login User ID: 3").
        // Let's verify ID 3 exists.
        
        const sellerId = 3; // Admin

        const formData = new FormData();
        formData.append('name', 'IT WORKS! Delete Me');
        formData.append('description', 'This item belongs to Admin. You should be able to delete it.');
        formData.append('price', '0');
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
            console.log(`Created Item ID: ${data.item.id} for Seller ID: ${sellerId}`);
        } else {
            console.log('Failed to create item', createRes.status);
        }

    } catch (err) {
        console.error(err);
    }
}

run();
