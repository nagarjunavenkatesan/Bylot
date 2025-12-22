
const API_URL = 'http://localhost:4173/api';

async function run() {
    try {
        const itemId = 12;
        const res = await fetch(`${API_URL}/items/${itemId}`);
        const item = await res.json();
        
        console.log(`Item ${item.id}: "${item.name}"`);
        console.log(`Seller ID: ${item.seller_id}`);
        
        // Check verify Admin ID
        // We know Admin is ID 3 from previous logs, but let's confirm login
        const loginRes = await fetch(`${API_URL}/login`, {
             method: 'POST',
             headers: { 'Content-Type': 'application/json' },
             body: JSON.stringify({ email: 'admin@bylot.com', password: 'password' })
        });
        const loginData = await loginRes.json();
        console.log(`Admin User ID: ${loginData.user.id}`);
        
        if (item.seller_id == loginData.user.id) { // Loose equality just to be safe in script
            console.log("MATCH: Admin OWNS this item.");
        } else {
             console.log("MISMATCH: Admin does NOT own this item.");
        }

    } catch (err) {
        console.error(err);
    }
}

run();
