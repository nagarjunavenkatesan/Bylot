
const API_URL = 'http://localhost:4173/api';

async function run() {
    try {
        // 1. Create User
        // Actually let's just Login if we can or Assume User 1 exists.
        // Let's create an item with User 1.
        const formData = new FormData();
        formData.append('name', 'Type Check Item');
        formData.append('price', '10');
        formData.append('sellerId', 1); // User 1
        
        const createRes = await fetch(`${API_URL}/items`, { method: 'POST', body: formData });
        const createData = await createRes.json();
        const itemId = createData.item.id;
        
        // 2. Fetch it back
        const getRes = await fetch(`${API_URL}/items/${itemId}`);
        const product = await getRes.json();
        
        console.log('Product Seller ID:', product.seller_id, 'Type:', typeof product.seller_id);
        
        // 3. User Mock
        // In frontend it is JSON.parse(localStorage.getItem('user')).
        // If we saved { id: 1 } it stays number.
        
        // Let's also check what Login returns
        // We need a valid login. 'admin@bylot.com' / 'password'
        const loginRes = await fetch(`${API_URL}/login`, {
             method: 'POST',
             headers: { 'Content-Type': 'application/json' },
             body: JSON.stringify({ email: 'admin@bylot.com', password: 'password' })
        });
        
        if (loginRes.ok) {
            const loginData = await loginRes.json();
            console.log('Login User ID:', loginData.user.id, 'Type:', typeof loginData.user.id);
        } else {
            console.log('Login failed (maybe user doesnt exist yet? we created it in script earlier)');
        }

    } catch (err) {
        console.error(err);
    }
}

run();
