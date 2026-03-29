const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// Main Database (In-memory for prototype)
let storeItems = [
    {
        id: 1,
        title: "Sourdough Bread",
        vendorEmail: "farmerjohn@gmail.com",
        vendorName: "Farmer John's Bakery",
        vendorPhone: "+91 98765 43210",
        price: 8.50,
        originalPrice: 8.50,
        status: 'IN_STOCK',
        timerTarget: null,
        flashSaleActive: false,
        reservedTokens: []
    },
    {
        id: 2,
        title: "Alphonso Mangoes (Box of 4)",
        vendorEmail: "orchardheights@gmail.com",
        vendorName: "Orchard Heights",
        vendorPhone: "+91 87654 32109",
        price: 12.00,
        originalPrice: 12.00,
        status: 'IN_STOCK',
        timerTarget: null,
        flashSaleActive: false,
        reservedTokens: []
    }
];

let platformMetrics = { totalIncome: 0, salesHistory: [] };

// Advanced User Database Tracking
// Mapping email -> Profile
let users = {
    "farmerjohn@gmail.com": { 
        name: "Farmer John", 
        email: "farmerjohn@gmail.com", 
        password: "password123", 
        role: "VENDOR", 
        shopName: "Farmer John's Bakery", 
        phoneNumber: "+91 98765 43210",
        totalGenerated: 0 
    },
    "orchardheights@gmail.com": { 
        name: "Orchard Heights", 
        email: "orchardheights@gmail.com", 
        password: "password123", 
        role: "VENDOR", 
        shopName: "Orchard Heights", 
        phoneNumber: "+91 87654 32109",
        totalGenerated: 0 
    }
};

app.get('/api/state', (req, res) => {
    // Break down users for the admin table
    const customers = Object.values(users).filter(u => u.role === 'CUSTOMER');
    const vendors = Object.values(users).filter(u => u.role === 'VENDOR');
    
    res.json({
        storeItems,
        platformMetrics,
        customers,
        vendors
    });
});

// Registration Route
app.post('/api/register', (req, res) => {
    const { name, email, password, role, shopName, phoneNumber } = req.body;
    
    if (users[email]) {
        return res.status(400).json({ success: false, message: "Email already exists." });
    }
    
    users[email] = {
        name,
        email,
        password,
        role,
        shopName: role === 'VENDOR' ? shopName : null,
        phoneNumber: role === 'VENDOR' ? phoneNumber : null,
        walletBalance: role === 'CUSTOMER' ? 0 : 0,
        totalSpent: role === 'CUSTOMER' ? 0 : 0,
        totalGenerated: role === 'VENDOR' ? 0 : 0
    };
    
    res.json({ success: true, user: users[email] });
});

// Login Route
app.post('/api/login', (req, res) => {
    const { email, password } = req.body;
    const user = users[email];
    
    if (user && user.password === password) {
        res.json({ success: true, user });
    } else {
        res.status(401).json({ success: false, message: "Invalid email or password." });
    }
});

// Profile Update Route
app.post('/api/profile/update', (req, res) => {
    const { email, name, shopName, phoneNumber } = req.body;
    const user = users[email];
    
    if (user) {
        user.name = name;
        if (user.role === 'VENDOR') {
            user.shopName = shopName;
            user.phoneNumber = phoneNumber;
            
            // Sync current items with new vendor details
            storeItems.forEach(item => {
                if (item.vendorEmail === email) {
                    item.vendorName = shopName;
                    item.vendorPhone = phoneNumber;
                }
            });
        }
        res.json({ success: true, user });
    } else {
        res.status(404).json({ success: false, message: "User not found." });
    }
});

// Primary Sync Overwrite (for simpler state-based updates)
app.post('/api/state', (req, res) => {
    const data = req.body;
    
    if(data.storeItems) storeItems = data.storeItems;
    if(data.platformMetrics) platformMetrics = data.platformMetrics;
    
    // Specifically handle user wallet/spending updates from sync
    if(data.currentUser) {
        const user = users[data.currentUser.email];
        if (user) {
            user.walletBalance = data.currentUser.walletBalance;
            user.totalSpent = data.currentUser.totalSpent;
            user.totalGenerated = data.currentUser.totalGenerated;
        }
    }
    
    res.json({ success: true });
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`\n🚀 Digital Street Backend [v3 - Accounts & Profiles] Active!`);
    console.log(`🌐 API listening securely on Port ${PORT}`);
});
