// Master Application Logic with Firebase Firestore Real-Time Core

let storeItems = [];
let platformMetrics = { totalIncome: 0, salesHistory: [] };
let customersArray = [];
let vendorsArray = [];
let currentUser = null; 

// Formatting utility
const formatCurrency = (amt) => "₹" + (amt || 0).toFixed(2);
const generateHoldCode = () => Math.floor(1000 + Math.random() * 9000).toString();

window.initApp = async function() {
    lucide.createIcons();
    
    // 1. Initial Auth Setup & Real-time Profile Sync
    auth.onAuthStateChanged(async (user) => {
        if (!user) {
            if (!window.location.pathname.includes('index.html') && !window.location.pathname.includes('admin.html')) {
                window.location.href = 'index.html';
            }
            return;
        }

        // Listen for real-time changes to the current user's profile
        db.collection('users').doc(user.uid).onSnapshot(doc => {
            if (doc.exists) {
                currentUser = { ...doc.data(), uid: doc.id };
                localStorage.setItem('digitalStreetSession', JSON.stringify(currentUser));
                
                // Update UI Header
                const headerName = document.getElementById('user-display-name');
                if (headerName) {
                    headerName.innerText = currentUser.role === 'VENDOR' ? (currentUser.shopName || currentUser.name) : currentUser.name;
                }
                reRenderActive();
            }
        });
    });

    // 2. Real-time Product Stream
    db.collection('products').onSnapshot(snapshot => {
        storeItems = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
        reRenderActive();
    });

    // 3. Real-time Metrics Stream (Admins)
    db.collection('platform').doc('metrics').onSnapshot(doc => {
        if (doc.exists) {
            platformMetrics = doc.data();
            reRenderActive();
        }
    });

    // 4. Real-time User Directory (Admins)
    db.collection('users').onSnapshot(snapshot => {
        const allUsers = snapshot.docs.map(doc => ({ ...doc.data(), uid: doc.id }));
        customersArray = allUsers.filter(u => u.role === 'CUSTOMER');
        vendorsArray = allUsers.filter(u => u.role === 'VENDOR');
        reRenderActive();
    });

    setInterval(tickTimers, 1000);
};

/* ================= PROFILE & AUTH ================= */
window.logout = function() {
    auth.signOut().then(() => {
        localStorage.removeItem('digitalStreetSession');
        window.location.href = 'index.html';
    });
}

window.openProfileModal = function() {
    if(!currentUser) return;
    const modal = document.getElementById("profile-modal");
    if(!modal) return;
    document.getElementById("profile-name").value = currentUser.name || "";
    if(currentUser.role === 'VENDOR') {
        const vFields = document.getElementById("profile-vendor-fields");
        if(vFields) vFields.style.display = 'block';
        document.getElementById("profile-shopname").value = currentUser.shopName || "";
        document.getElementById("profile-phone").value = currentUser.phoneNumber || "";
    }
    modal.classList.remove("hidden");
}

window.closeProfileModal = function() {
    document.getElementById("profile-modal").classList.add("hidden");
}

window.updateProfile = async function() {
    if(!currentUser) return;
    const updates = {
        name: document.getElementById("profile-name").value.trim(),
    };
    if(currentUser.role === 'VENDOR') {
        updates.shopName = document.getElementById("profile-shopname").value.trim();
        updates.phoneNumber = document.getElementById("profile-phone").value.trim();
    }

    try {
        await db.collection('users').doc(currentUser.uid).update(updates);
        showToast("Profile Updated Successfully!");
        closeProfileModal();
    } catch(e) {
        showToast("Error updating profile.");
    }
}

/* ================= CUSTOMER VIEW RENDERING ================= */
function renderCustomerView() {
    const balanceElem = document.getElementById("customer-wallet-balance");
    if (balanceElem && currentUser) {
        balanceElem.innerText = formatCurrency(currentUser.walletBalance || 0);
    }

    const list = document.getElementById("customer-product-list");
    if (!list) return;
    list.innerHTML = "";

    storeItems.forEach(item => {
        const card = document.createElement("div");
        card.className = "product-card glass-panel";
        
        const vendorContactHTML = `
            <div class="vendor-info-card" style="margin-top: 0.5rem; padding: 0.5rem; background: rgba(255,255,255,0.03); border-radius: 6px;">
                <div style="font-size: 0.75rem; color: var(--text-secondary);"><i data-lucide="store" style="width:12px; height:12px"></i> ${item.vendorName || 'Local Shop'}</div>
                <div style="font-size: 0.8rem; font-weight:600; color: var(--accent-blue); display:flex; align-items:center; gap:0.3rem;">
                    <i data-lucide="phone" style="width:12px; height:12px"></i> Call: ${item.vendorPhone || 'Private'}
                </div>
            </div>
        `;

        let badgeHTML = "";
        let reserveHTML = "";
        let priceHTML = `<span>${formatCurrency(item.price)}</span>`;
        if (item.flashSaleActive) {
            priceHTML = `<small>${formatCurrency(item.originalPrice)}</small><span>${formatCurrency(item.price)}</span>`;
        }
        
        if (item.status === 'IN_STOCK') {
            badgeHTML = `<span class="badge badge-stock"><i data-lucide="check-circle" style="width:12px; height:12px"></i> In Stock</span>`;
            if (item.flashSaleActive) badgeHTML += ` <span class="badge badge-flash"><i data-lucide="zap" style="width:12px; height:12px"></i> Flash Deal Active</span>`;
            
            reserveHTML = `<button class="primary-btn" style="width:100%; margin-top:1rem; justify-content:center; background:var(--accent-green); color:black;" onclick="reserveItem('${item.id}')">
                            <i data-lucide="shopping-cart"></i> Buy & Reserve (${formatCurrency(item.price)})
                          </button>`;
                          
            if(currentUser && (currentUser.walletBalance || 0) < item.price) {
                reserveHTML = `<button class="primary-btn" style="width:100%; margin-top:1rem; justify-content:center; opacity:0.5; background:var(--panel-border);" disabled>
                                Insufficient Balance
                              </button>`;
            }
                          
        } else if (item.status === 'SOLD_OUT') {
            badgeHTML = `<span class="badge badge-sold"><i data-lucide="x-circle" style="width:12px; height:12px"></i> Sold Out</span>`;
            reserveHTML = `<button class="btn-reserve" disabled>Sold Out</button>`;
        } else if (item.status === 'TIMER') {
            const timeLeft = Math.max(0, Math.ceil((item.timerTarget - Date.now()) / 1000 / 60));
            badgeHTML = `<span class="badge badge-timer"><i data-lucide="flame" style="width:12px; height:12px"></i> Batch Ready in <span class="timer-display-${item.id}">${timeLeft}</span>m</span>`;
            reserveHTML = `<button class="btn-reserve" disabled>Baking...</button>`;
        }

        let tokenDisplay = "";
        const myTokens = item.reservedTokens ? item.reservedTokens.filter(rt => rt.ownerEmail === currentUser?.email) : [];
        if (myTokens.length > 0) {
            tokenDisplay = `
                <div class="code-reveal">
                    <h4>Receipt / Pickup Code</h4>
                    <div class="code">${myTokens[myTokens.length - 1].code}</div>
                    <small style="color:var(--text-secondary)">Show code to vendor to collect goods.</small>
                </div>
            `;
            reserveHTML = ""; 
        }

        card.innerHTML = `
            <div class="product-info-top">
                <div class="product-title">
                    <h3>${item.title}</h3>
                </div>
                <div class="price-tag">${priceHTML}</div>
            </div>
            ${vendorContactHTML}
            <div style="margin-top: 0.5rem;">${badgeHTML}</div>
            ${tokenDisplay}
            ${reserveHTML}
        `;
        list.appendChild(card);
    });
    lucide.createIcons(); 
}

/* ================= WALLET ================= */
window.openAddFundsModal = function() {
    document.getElementById("add-funds-modal").classList.remove("hidden");
    document.getElementById("wallet-deposit-amount").focus();
}
window.closeAddFundsModal = function() {
    document.getElementById("add-funds-modal").classList.add("hidden");
}
window.confirmAddFunds = async function() {
    const depositAmt = parseFloat(document.getElementById("wallet-deposit-amount").value.trim());
    if (isNaN(depositAmt) || depositAmt <= 0) return showToast("Invalid deposit amount.");
    if (!currentUser) return;
    
    try {
        await db.collection('users').doc(currentUser.uid).update({
            walletBalance: firebase.firestore.FieldValue.increment(depositAmt)
        });
        closeAddFundsModal();
        showToast(`Successfully deposited ${formatCurrency(depositAmt)}.`);
    } catch(e) {
        showToast("Error updating wallet.");
    }
}

/* ================= VENDOR VIEW RENDERING ================= */
function renderVendorView() {
    const salesElem = document.getElementById("vendor-daily-sales");
    if (salesElem && currentUser) {
        salesElem.innerText = formatCurrency(currentUser.totalGenerated || 0);
    }
    const list = document.getElementById("vendor-product-list");
    if (!list) return;
    list.innerHTML = "";
    
    const myItems = storeItems.filter(i => i.vendorEmail === currentUser?.email);
    if(myItems.length === 0) {
        list.innerHTML = "<div style='text-align:center; padding: 2rem; color:var(--text-secondary);'>No products listed yet.</div>";
    }

    myItems.forEach(item => {
        const card = document.createElement("div");
        card.className = "vendor-item-card glass-panel";
        const isStocked = item.status === 'IN_STOCK';
        const isTimer = item.status === 'TIMER';
        let stockToggleText = isStocked ? "Set Sold Out" : (isTimer ? "Cancel Timer" : "Set In Stock");

        card.innerHTML = `
            <div class="product-info-top" style="flex-direction: column;">
                <h3>${item.title}</h3>
                <span style="color:var(--text-secondary); margin-bottom: 0.5rem">Holds: ${item.reservedTokens?item.reservedTokens.length:0}</span>
                ${item.flashSaleActive ? '<div class="flash-active-notice">Flash Active (-20%)</div>' : ''}
            </div>
            <div class="controls-row">
                <button class="huge-btn" onclick="toggleStock('${item.id}')">${stockToggleText}</button>
                <button class="huge-btn" onclick="toggleBatchDrawer('${item.id}')">Batch...</button>
                <button class="huge-btn" onclick="toggleFlashSale('${item.id}')">${item.flashSaleActive ? 'End Flash' : 'Flash Sale'}</button>
                <button class="huge-btn" style="background:var(--accent-orange)" onclick="logSale('${item.id}')">Log Sale</button>
            </div>
            <div id="batch-drawer-${item.id}" class="timer-drawer" style="display:none;">
                <button class="timer-btn" onclick="startBatchTimer('${item.id}', 10)">10m</button>
                <button class="timer-btn" onclick="startBatchTimer('${item.id}', 30)">30m</button>
                <button class="timer-btn" onclick="startBatchTimer('${item.id}', 60)">60m</button>
            </div>
        `;
        list.appendChild(card);
    });
    lucide.createIcons();
}

/* ================= ADMIN VIEW RENDERING ================= */
function renderAdminView() {
    const incElem = document.getElementById("admin-total-income");
    const soldElem = document.getElementById("admin-total-sold");
    const custBody = document.getElementById("admin-customers-table");
    const vendBody = document.getElementById("admin-vendors-table");
    
    if(incElem) incElem.innerText = formatCurrency(platformMetrics.totalIncome || 0);
    if(soldElem) soldElem.innerText = platformMetrics.salesHistory ? platformMetrics.salesHistory.length : 0;

    if(custBody) {
        custBody.innerHTML = "";
        customersArray.forEach(c => {
            custBody.innerHTML += `<tr style="border-bottom: 1px solid rgba(255,255,255,0.1);"><td style="padding: 1rem;">${c.name}<br><small>${c.email}</small></td><td style="padding: 1rem;">${formatCurrency(c.walletBalance)}</td><td style="padding: 1rem; color: var(--accent-blue);">${formatCurrency(c.totalSpent)}</td></tr>`;
        });
    }
    if(vendBody) {
        vendBody.innerHTML = "";
        vendorsArray.forEach(v => {
            vendBody.innerHTML += `<tr style="border-bottom: 1px solid rgba(255,255,255,0.1);"><td style="padding: 1rem;">${v.shopName}<br><small>${v.name}</small></td><td style="padding: 1rem;">${v.phoneNumber || 'N/A'}</td><td style="padding: 1rem; color: var(--accent-green);">${formatCurrency(v.totalGenerated)}</td></tr>`;
        });
    }
    lucide.createIcons();
}

/* ================= FIREBASE ACTIONS ================= */
window.logSale = async function(id) {
    const item = storeItems.find(i => i.id === id);
    if (!item || !currentUser) return;

    const batch = db.batch();
    const metricsRef = db.collection('platform').doc('metrics');
    const userRef = db.collection('users').doc(currentUser.uid);

    batch.update(metricsRef, {
        totalIncome: firebase.firestore.FieldValue.increment(item.price),
        salesHistory: firebase.firestore.FieldValue.arrayUnion({
            title: item.title, vendor: item.vendorName, price: item.price, timestamp: Date.now()
        })
    });
    batch.update(userRef, {
        totalGenerated: firebase.firestore.FieldValue.increment(item.price)
    });

    try {
        await batch.commit();
        showToast("Sale Logged to Cloud!");
    } catch(e) {
        showToast("Error logging sale.");
    }
}

window.reserveItem = async function(id) {
    const item = storeItems.find(i => i.id === id);
    if (!item || item.status !== 'IN_STOCK' || !currentUser) return;
    if ((currentUser.walletBalance || 0) < item.price) return showToast("Insufficient Balance!");

    const batch = db.batch();
    const itemRef = db.collection('products').doc(id);
    const userRef = db.collection('users').doc(currentUser.uid);
    const token = { code: generateHoldCode(), expires: Date.now() + (30 * 60 * 1000), ownerEmail: currentUser.email };

    batch.update(itemRef, {
        reservedTokens: firebase.firestore.FieldValue.arrayUnion(token)
    });
    batch.update(userRef, {
        walletBalance: firebase.firestore.FieldValue.increment(-item.price),
        totalSpent: firebase.firestore.FieldValue.increment(item.price)
    });

    try {
        await batch.commit();
        showToast("Purchase Confirmed!");
    } catch(e) {
        showToast("Transaction failed.");
    }
}

window.toggleStock = async function(id) {
    const item = storeItems.find(i => i.id === id);
    if (!item) return;
    const newStatus = (item.status === 'IN_STOCK' || item.status === 'TIMER') ? 'SOLD_OUT' : 'IN_STOCK';
    await db.collection('products').doc(id).update({
        status: newStatus,
        timerTarget: null
    });
}

window.toggleFlashSale = async function(id) {
    const item = storeItems.find(i => i.id === id);
    if (!item) return;
    const active = !item.flashSaleActive;
    await db.collection('products').doc(id).update({
        flashSaleActive: active,
        price: active ? item.originalPrice * 0.8 : item.originalPrice
    });
}

window.startBatchTimer = async function(id, mins) {
    await db.collection('products').doc(id).update({
        status: 'TIMER',
        timerTarget: Date.now() + (mins * 60000)
    });
}

window.saveNewItem = async function() {
    const name = document.getElementById("new-item-name").value.trim();
    const price = parseFloat(document.getElementById("new-item-price").value.trim());
    if (!name || isNaN(price) || !currentUser) return showToast("Invalid inputs.");

    await db.collection('products').add({
        title: name,
        price,
        originalPrice: price,
        status: 'IN_STOCK',
        vendorEmail: currentUser.email,
        vendorName: currentUser.shopName || currentUser.name,
        vendorPhone: currentUser.phoneNumber || 'N/A',
        reservedTokens: [],
        flashSaleActive: false,
        createdAt: Date.now()
    });
    document.getElementById("add-item-modal").classList.add("hidden");
    showToast("Product Added to the Street!");
}

async function tickTimers() {
    storeItems.forEach(async item => {
        if (item.status === 'TIMER' && item.timerTarget) {
            if (Date.now() >= item.timerTarget) {
                await db.collection('products').doc(item.id).update({ status: 'IN_STOCK', timerTarget: null });
            } else {
                const displays = document.querySelectorAll(`.timer-display-${item.id}`);
                const timeLeft = Math.max(0, Math.ceil((item.timerTarget - Date.now()) / 1000));
                displays.forEach(d => { d.innerText = Math.ceil(timeLeft/60); }); 
            }
        }
    });
}

function showToast(msg) {
    const container = document.getElementById("toast-container");
    if(!container) return;
    const toast = document.createElement("div");
    toast.className = "toast";
    toast.innerHTML = `<i data-lucide="bell" class="toast-icon"></i> <span>${msg}</span>`;
    container.appendChild(toast);
    lucide.createIcons();
    setTimeout(() => { toast.classList.add('toast-fade-out'); setTimeout(() => toast.remove(), 300); }, 4000);
}

function reRenderActive() {
    if(window.APP_MODE === 'CUSTOMER') renderCustomerView();
    if(window.APP_MODE === 'VENDOR') renderVendorView();
    if(window.APP_MODE === 'ADMIN') renderAdminView();
}

window.toggleBatchDrawer = (id) => {
    const d = document.getElementById(`batch-drawer-${id}`);
    if (d) d.style.display = d.style.display === 'none' ? 'flex' : 'none';
}
window.addNewItem = () => document.getElementById("add-item-modal").classList.remove("hidden");
window.closeAddModal = () => document.getElementById("add-item-modal").classList.add("hidden");
