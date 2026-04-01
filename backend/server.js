const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;
const DB_FILE = path.join(__dirname, '..', 'database.json'); // Moved to Project Root
const FRONTEND_DIR = path.join(__dirname, '..', 'frontend');

// Serve static frontend files
app.use(express.static(FRONTEND_DIR));

// 🔄 Friendly Routing (Handle clean URLs for static pages)
app.get('/customer', (req, res) => res.sendFile(path.join(FRONTEND_DIR, 'customer.html')));
app.get('/vendor', (req, res) => res.sendFile(path.join(FRONTEND_DIR, 'vendor.html')));
app.get('/admin', (req, res) => res.sendFile(path.join(FRONTEND_DIR, 'admin.html')));
app.get('/admin_login', (req, res) => res.sendFile(path.join(FRONTEND_DIR, 'admin_login.html')));
app.get('/login', (req, res) => res.sendFile(path.join(FRONTEND_DIR, 'index.html')));

// Catch-all: Redirect undefined routes to the welcome page
app.get('*', (req, res) => res.sendFile(path.join(FRONTEND_DIR, 'index.html')));

// 🩺 Health Check
app.get('/api/ping', (req, res) => res.json({ status: 'ok', timestamp: new Date() }));

// Initialize State from Disk or Defaults
let state = {
    version: Date.now(), // 🚀 Version tracking for speed
    storeItems: [
        { id: 1, title: 'Fresh Sourdough', price: 120, originalPrice: 120, status: 'IN_STOCK', vendorName: 'Anivesh Bakery', vendorPhone: '+91 999 000 111', vendorEmail: 'anivesh@example.com', visual: 'sandwich', flashSaleActive: false, reservedTokens: [] },
        { id: 2, title: 'Farm Eggs (Dozen)', price: 180, originalPrice: 180, status: 'IN_STOCK', vendorName: 'Green Meadows', vendorPhone: '+91 888 777 666', vendorEmail: 'green@example.com', visual: 'egg', flashSaleActive: false, reservedTokens: [] }
    ],
    platformMetrics: { totalIncome: 0, salesHistory: [] },
    users: []
};

function loadDB() {
    try {
        if (fs.existsSync(DB_FILE)) {
            const data = fs.readFileSync(DB_FILE, 'utf8');
            state = JSON.parse(data);
            console.log("💾 Database Loaded from Disk.");
        }
    } catch (e) {
        console.error("Error loading DB", e);
    }
}

function saveDB() {
    state.version = Date.now(); // 🚀 Increment version
    try {
        fs.writeFileSync(DB_FILE, JSON.stringify(state, null, 2), 'utf8');
        console.log("📂 Database Saved to Disk.");
    } catch (e) {
        console.error("Error saving DB", e);
    }
}

loadDB();

// API Endpoints
app.get('/api/state', (req, res) => {
    const customers = state.users.filter(u => u.role === 'CUSTOMER');
    const vendors = state.users.filter(u => u.role === 'VENDOR');
    res.json({ ...state, customers, vendors });
});

app.post('/api/state', (req, res) => {
    state.storeItems = req.body.storeItems;
    state.platformMetrics = req.body.platformMetrics;
    
    if(req.body.currentUser) {
        const uIdx = state.users.findIndex(u => u.email === req.body.currentUser.email);
        if(uIdx !== -1) {
            // Preserve the password hash when updating other user stats
            const currentHash = state.users[uIdx].password;
            state.users[uIdx] = { ...req.body.currentUser, password: currentHash };
        }
    }
    
    saveDB();
    res.json({ success: true });
});

app.post('/api/register', async (req, res) => {
    const { name, email, password, role, shopName, phoneNumber } = req.body;
    if (state.users.find(u => u.email === email)) {
        return res.status(400).json({ success: false, message: "User already exists." });
    }

    // 🔐 Security: Hash Password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newUser = { 
        name, email, password: hashedPassword, role, shopName, phoneNumber,
        walletBalance: 0, totalSpent: 0, totalGenerated: 0 
    };
    state.users.push(newUser);
    saveDB();
    
    // Return user without hash
    const { password: _, ...userWithoutPass } = newUser;
    res.json({ success: true, user: userWithoutPass });
});

app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;
    
    // 🛡️ Admin Override
    if (email === 'admin@admin.com' && password === 'Anivesh@123') {
        return res.json({ 
            success: true, 
            user: { name: 'Platform Admin', email: 'admin@admin.com', role: 'ADMIN', walletBalance: 0, totalSpent: 0, totalGenerated: 0 } 
        });
    }

    const user = state.users.find(u => u.email === email);
    
    if (user) {
        // 🔐 Security: Securely Compare Hashes
        const isMatch = await bcrypt.compare(password, user.password);
        if (isMatch) {
            const { password: _, ...userWithoutPass } = user;
            return res.json({ success: true, user: userWithoutPass });
        }
    }
    
    res.status(401).json({ success: false, message: "Invalid Credentials." });
});

app.post('/api/profile/update', (req, res) => {
    const { email, name, shopName, phoneNumber } = req.body;
    const uIdx = state.users.findIndex(u => u.email === email);
    if (uIdx !== -1) {
        state.users[uIdx].name = name;
        if (state.users[uIdx].role === 'VENDOR') {
            state.users[uIdx].shopName = shopName;
            state.users[uIdx].phoneNumber = phoneNumber;
        }
        state.storeItems.forEach(item => {
            if(item.vendorEmail === email) {
                item.vendorName = shopName || name;
                item.vendorPhone = phoneNumber;
            }
        });
        saveDB();
        
        const { password: _, ...userWithoutPass } = state.users[uIdx];
        res.json({ success: true, user: userWithoutPass });
    } else {
        res.status(404).json({ success: false });
    }
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Digital Street Platform running at http://localhost:${PORT}`);
    console.log(`📁 Database: ${DB_FILE}`);
    console.log(`🌐 Serving Frontend from: ${FRONTEND_DIR}`);
});
