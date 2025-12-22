
const API_URL = 'http://localhost:5000/api';

async function run() {
    try {
        const email = 'admin@bylot.com';
        const password = 'password';
        
        // Try to register (might fail if exists)
        const registerRes = await fetch(`${API_URL}/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: 'Admin User',
                email,
                phone: '0000000000',
                password
            })
        });
        
        if (registerRes.ok) {
             console.log('User created: admin@bylot.com / password');
        } else {
             // Maybe already exists?
             console.log('Register response:', registerRes.status);
        }
        
    } catch (err) {
        console.error('Error:', err);
    }
}

run();
