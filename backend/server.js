const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

const DB_FILE = path.join(__dirname, 'database.json');

// Initialize State from Disk or Defaults
let state = {
    storeItems: [
        { id: 1, title: 'Fresh Sourdough', price: 120, originalPrice: 120, status: 'IN_STOCK', vendorName: 'Anivesh Bakery', vendorPhone: '+91 999 000 111', vendorEmail: 'anivesh@example.com', flashSaleActive: false, reservedTokens: [] },
        { id: 2, title: 'Farm Eggs (Dozen)', price: 180, originalPrice: 180, status: 'IN_STOCK', vendorName: 'Green Meadows', vendorPhone: '+91 888 777 666', vendorEmail: 'green@example.com', flashSaleActive: false, reservedTokens: [] }
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
    
    // Update individual user stats if provided
    if(req.body.currentUser) {
        const uIdx = state.users.findIndex(u => u.email === req.body.currentUser.email);
        if(uIdx !== -1) state.users[uIdx] = req.body.currentUser;
    }
    
    saveDB();
    res.json({ success: true });
});

app.post('/api/register', (req, res) => {
    const { name, email, password, role, shopName, phoneNumber } = req.body;
    if (state.users.find(u => u.email === email)) {
        return res.status(400).json({ success: false, message: "User already exists." });
    }
    const newUser = { 
        name, email, password, role, shopName, phoneNumber,
        walletBalance: 0, totalSpent: 0, totalGenerated: 0 
    };
    state.users.push(newUser);
    saveDB();
    res.json({ success: true, user: newUser });
});

app.post('/api/login', (req, res) => {
    const { email, password } = req.body;
    const user = state.users.find(u => u.email === email && u.password === password);
    if (user) {
        res.json({ success: true, user });
    } else {
        res.status(401).json({ success: false, message: "Invalid Credentials." });
    }
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
        // Update items owned by this vendor too
        state.storeItems.forEach(item => {
            if(item.vendorEmail === email) {
                item.vendorName = shopName || name;
                item.vendorPhone = phoneNumber;
            }
        });
        saveDB();
        res.json({ success: true, user: state.users[uIdx] });
    } else {
        res.status(404).json({ success: false });
    }
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`🚀 Persistent Backend running at http://localhost:${PORT}`);
    console.log(`📁 Saving data to: ${DB_FILE}`);
});
