
const API_URL = 'http://localhost:4173/api'; // Testing against Preview

async function run() {
    try {
        console.log("Creating item to delete...");
        
        // 1. Create Item
        const formData = new FormData();
        formData.append('name', 'Delete Test Item');
        formData.append('description', 'To be deleted');
        formData.append('price', '10');
        formData.append('sellerId', 1); // Assuming user 1 exists
        formData.append('category', 'Other');
        formData.append('expiryDate', '2025-12-31');
        
        // We can skip image for this test or use text file if validation requires it
        // The backend code suggests image is optional? No, upload.single('image') might run but if req.file is missing it continues.
        // Wait, database schema? 
        // "image_url TEXT" - nullable? 
        // Let's try without file first.

        const createRes = await fetch(`${API_URL}/items`, {
            method: 'POST',
            body: formData
        });
        
        if (!createRes.ok) {
            const txt = await createRes.text();
            throw new Error(`Create failed: ${createRes.status} ${txt}`);
        }

        const createData = await createRes.json();
        const itemId = createData.item.id;
        console.log(`Item created with ID: ${itemId}`);

        // 2. Delete Item
        console.log(`Deleting item ${itemId}...`);
        const deleteRes = await fetch(`${API_URL}/items/${itemId}`, {
            method: 'DELETE'
        });

        const deleteText = await deleteRes.text();
        console.log(`Delete Response Status: ${deleteRes.status}`);
        console.log(`Delete Response Body: ${deleteText}`);

        if (deleteRes.ok) {
            console.log("SUCCESS: Item deleted.");
        } else {
            console.error("FAILURE: Delete failed.");
        }

    } catch (err) {
        console.error('ERROR:', err);
    }
}

run();
