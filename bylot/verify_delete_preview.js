
const API_URL = 'http://localhost:4173/api';

async function run() {
    try {
        const itemId = 10; // The item I created for Admin
        console.log(`Attempting to delete item ${itemId} via Preview...`);
        
        const deleteRes = await fetch(`${API_URL}/items/${itemId}`, {
            method: 'DELETE'
        });
        
        console.log(`Status: ${deleteRes.status}`);
        const text = await deleteRes.text();
        console.log(`Response: ${text}`);
        
        if (deleteRes.ok) {
            console.log("SUCCESS: Item deleted via Preview.");
        } else {
             console.log("FAILURE: Could not delete.");
        }

    } catch (err) {
        console.error(err);
    }
}

run();
