// Master Application Logic - Local Persistent Version

let storeItems = [];
let platformMetrics = { totalIncome: 0, salesHistory: [] };
let customersArray = [];
let vendorsArray = [];
let currentUser = null; 
let searchQuery = ""; // NEW: Search state

// Dynamically route API
const currentHost = window.location.hostname;
const API_BASE = `http://${currentHost}:3000/api`;

async function loadStore() {
    try {
        const res = await fetch(`${API_BASE}/state`);
        if(!res.ok) throw new Error("Network error");
        const data = await res.json();
        
        storeItems = data.storeItems;
        platformMetrics = data.platformMetrics;
        customersArray = data.customers;
        vendorsArray = data.vendors;
        
        const session = localStorage.getItem('digitalStreetSession');
        if(session) {
            const parsedSession = JSON.parse(session);
            const allUsers = [...customersArray, ...vendorsArray];
            const freshUser = allUsers.find(u => u.email === parsedSession.email);
            if(freshUser) {
                currentUser = freshUser;
                localStorage.setItem('digitalStreetSession', JSON.stringify(currentUser));
            } else {
                localStorage.removeItem('digitalStreetSession');
                window.location.href = 'index.html';
            }
        } else {
            if(!window.location.pathname.includes('index.html') && !window.location.pathname.includes('admin.html')) {
                window.location.href = 'index.html';
            }
        }
    } catch(err) {
        console.error("Backend Server Unreachable.", err);
    }
}

async function saveStore() {
    try {
        await fetch(`${API_BASE}/state`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                storeItems,
                platformMetrics,
                currentUser 
            })
        });
    } catch(err) {
        console.error("Failed to save state", err);
    }
}

const formatCurrency = (amt) => "₹" + (amt || 0).toFixed(2);
const generateHoldCode = () => Math.floor(1000 + Math.random() * 9000).toString();

window.initApp = async function() {
    lucide.createIcons();
    await loadStore();
    
    if(currentUser) {
        const headerName = document.getElementById('user-display-name');
        if(headerName) {
            headerName.innerText = currentUser.role === 'VENDOR' ? (currentUser.shopName || currentUser.name) : currentUser.name;
        }
    }
    
    reRenderActive();
    setInterval(async () => { await loadStore(); reRenderActive(); }, 3000);
    setInterval(tickTimers, 1000);
};

/* ================= PROFILE LOGIC ================= */
window.openProfileModal = function() {
    if(!currentUser) return;
    const modal = document.getElementById("profile-modal");
    if(!modal) return;
    document.getElementById("profile-name").value = currentUser.name;
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
    const payload = {
        email: currentUser.email,
        name: document.getElementById("profile-name").value.trim(),
    };
    if(currentUser.role === 'VENDOR') {
        payload.shopName = document.getElementById("profile-shopname").value.trim();
        payload.phoneNumber = document.getElementById("profile-phone").value.trim();
    }
    try {
        const res = await fetch(`${API_BASE}/profile/update`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        if(data.success) {
            currentUser = data.user;
            localStorage.setItem('digitalStreetSession', JSON.stringify(currentUser));
            showToast("Profile Updated!");
            closeProfileModal();
            reRenderActive();
            const headerName = document.getElementById('user-display-name');
            if(headerName) headerName.innerText = currentUser.role === 'VENDOR' ? (currentUser.shopName || currentUser.name) : currentUser.name;
        }
    } catch(e) { showToast("Error updating profile."); }
}

window.logout = function() {
    localStorage.removeItem('digitalStreetSession');
    window.location.href = 'index.html';
}

/* ================= SEARCH LOGIC ================= */
window.handleSearch = function(val) {
    searchQuery = val.toLowerCase().trim();
    renderCustomerView();
}

/* ================= CUSTOMER VIEW ================= */
function renderCustomerView() {
    const balanceElem = document.getElementById("customer-wallet-balance");
    if (balanceElem && currentUser) balanceElem.innerText = formatCurrency(currentUser.walletBalance || 0);

    const list = document.getElementById("customer-product-list");
    const banner = document.getElementById("offers-banner");
    const bannerContainer = document.getElementById("offers-banner-container");
    if (!list) return;

    // 1. Filtering Logic
    const filteredItems = storeItems.filter(item => {
        const matchesSearch = item.title.toLowerCase().includes(searchQuery) || 
                             item.vendorName.toLowerCase().includes(searchQuery);
        return matchesSearch;
    });

    // 2. Banner Logic (Flash Sales)
    const flashSales = storeItems.filter(item => item.flashSaleActive && item.status === 'IN_STOCK');
    if (flashSales.length > 0 && searchQuery === "") {
        bannerContainer.classList.remove("hidden");
        banner.innerHTML = "";
        flashSales.forEach(item => {
            const div = document.createElement("div");
            div.className = "banner-item";
            
            let visualHTML = `<div class="banner-visual"><i data-lucide="package" class="product-icon"></i></div>`;
            if (item.visual) {
                if (item.visual.startsWith('http')) {
                    visualHTML = `<div class="banner-visual"><img src="${item.visual}" class="product-img"></div>`;
                } else {
                    visualHTML = `<div class="banner-visual"><i data-lucide="${item.visual}" class="product-icon"></i></div>`;
                }
            }

            div.innerHTML = `
                <div class="offer-badge">Sale</div>
                ${visualHTML}
                <div class="banner-info">
                    <h4 style="margin:0; font-size:0.9rem;">${item.title}</h4>
                    <div style="color:var(--accent-orange); font-weight:700;">${formatCurrency(item.price)}</div>
                    <small style="color:var(--text-secondary); font-size:0.7rem;">${item.vendorName}</small>
                </div>
            `;
            div.onclick = () => {
                const searchInput = document.getElementById("search-input");
                if(searchInput) { searchInput.value = item.title; handleSearch(item.title); }
            };
            banner.appendChild(div);
        });
    } else {
        bannerContainer.classList.add("hidden");
    }

    // 3. Main Grid Rendering
    list.innerHTML = "";
    if(filteredItems.length === 0) {
        list.innerHTML = `<div style="grid-column: 1/-1; text-align:center; padding: 3rem; color:var(--text-secondary);">No products found matching "${searchQuery}"</div>`;
    }

    filteredItems.forEach(item => {
        const card = document.createElement("div");
        card.className = "product-card glass-panel";
        const vendorContactHTML = `
            <div class="vendor-info-card" style="margin-top: 0.5rem; padding: 0.75rem; background: rgba(59, 130, 246, 0.05); border: 1px solid rgba(59, 130, 246, 0.1); border-radius: 8px;">
                <div style="font-size: 0.8rem; font-weight:700; color: var(--accent-blue); display:flex; align-items:center; gap:0.4rem; margin-bottom:0.2rem;">
                    <i data-lucide="store" style="width:14px; height:14px"></i> ${item.vendorName}
                </div>
                <div style="font-size: 0.75rem; color: var(--text-secondary); display:flex; align-items:center; gap:0.4rem;">
                    <i data-lucide="phone" style="width:12px; height:12px"></i> Call: ${item.vendorPhone}
                </div>
            </div>`;

        // Determine visual
        let visualHTML = `<div class="product-visual-container"><i data-lucide="package" class="product-icon"></i></div>`;
        if (item.visual) {
            if (item.visual.startsWith('http') || item.visual.startsWith('data:')) {
                visualHTML = `<div class="product-visual-container image-visual"><img src="${item.visual}" alt="${item.title}" class="product-img" onerror="this.src='https://images.unsplash.com/photo-1542831371-29b0f74f9713?q=80&w=200&auto=format&fit=crop'"></div>`;
            } else {
                visualHTML = `<div class="product-visual-container"><i data-lucide="${item.visual}" class="product-icon"></i></div>`;
            }
        }

        let priceHTML = `<span>${formatCurrency(item.price)}</span>`;
        if (item.flashSaleActive) priceHTML = `<small>${formatCurrency(item.originalPrice)}</small><span>${formatCurrency(item.price)}</span>`;
        
        let badgeHTML = "";
        let reserveHTML = "";
        if (item.status === 'IN_STOCK') {
            badgeHTML = `<span class="badge badge-stock">In Stock</span>`;
            if (item.flashSaleActive) badgeHTML += ` <span class="badge badge-flash">Flash Deal</span>`;
            reserveHTML = `<button class="primary-btn" style="width:100%; margin-top:1rem; justify-content:center; background:var(--accent-green); color:black;" onclick="reserveItem(${item.id})"><i data-lucide="shopping-cart"></i> Buy Now</button>`;
            if(currentUser && (currentUser.walletBalance || 0) < item.price) reserveHTML = `<button class="primary-btn" style="width:100%; margin-top:1rem; justify-content:center; opacity:0.5; background:var(--panel-border);" disabled>Refill Wallet</button>`;
        } else {
            badgeHTML = `<span class="badge badge-sold">Sold Out</span>`;
            reserveHTML = `<button class="btn-reserve" disabled>Not Available</button>`;
        }

        let tokenDisplay = "";
        const myTokens = item.reservedTokens ? item.reservedTokens.filter(rt => rt.ownerEmail === currentUser?.email) : [];
        if (myTokens.length > 0) {
            tokenDisplay = `<div class="code-reveal"><h4>Pickup Code</h4><div class="code">${myTokens[myTokens.length - 1].code}</div></div>`;
            reserveHTML = ""; 
        }

        card.innerHTML = `${visualHTML}<div class="product-info-top"><div class="product-title"><h3>${item.title}</h3></div><div class="price-tag">${priceHTML}</div></div>${vendorContactHTML}<div style="margin-top: 0.5rem;">${badgeHTML}</div>${tokenDisplay}${reserveHTML}`;
        list.appendChild(card);
    });
    lucide.createIcons(); 
}

/* ================= WALLET ================= */
window.openAddFundsModal = function() {
    const modal = document.getElementById("add-funds-modal");
    if(modal) { modal.classList.remove("hidden"); document.getElementById("wallet-deposit-amount").focus(); }
}
window.closeAddFundsModal = function() {
    const modal = document.getElementById("add-funds-modal");
    if(modal) { modal.classList.add("hidden"); document.getElementById("wallet-deposit-amount").value = ""; }
}
window.confirmAddFunds = async function() {
    await loadStore();
    const depositAmt = parseFloat(document.getElementById("wallet-deposit-amount").value.trim());
    if (isNaN(depositAmt) || depositAmt <= 0 || !currentUser) return showToast("Invalid amount.");
    currentUser.walletBalance = (currentUser.walletBalance || 0) + depositAmt;
    await saveStore();
    closeAddFundsModal();
    showToast(`Deposited ${formatCurrency(depositAmt)}.`);
    reRenderActive();
}

/* ================= VENDOR VIEW ================= */
function renderVendorView() {
    const salesElem = document.getElementById("vendor-daily-sales");
    if (salesElem && currentUser) salesElem.innerText = formatCurrency(currentUser.totalGenerated || 0);
    const list = document.getElementById("vendor-product-list");
    if (!list) return;
    list.innerHTML = "";
    const myItems = storeItems.filter(i => i.vendorEmail === currentUser?.email);
    if(myItems.length === 0) list.innerHTML = "<div style='text-align:center; padding: 2rem; color:var(--text-secondary);'>None listed yet.</div>";

    myItems.forEach(item => {
        const card = document.createElement("div");
        card.className = "vendor-item-card glass-panel";
        const isStocked = item.status === 'IN_STOCK';
        const isTimer = item.status === 'TIMER';
        let stockToggleText = isStocked ? "Set Sold Out" : (isTimer ? "Cancel timer" : "Set In Stock");

        // Determine if visual is an image URL or Lucide Icon
        let visualHTML = `<div class="product-visual-container mini-visual"><i data-lucide="package" class="product-icon"></i></div>`;
        if (item.visual) {
            if (item.visual.startsWith('http') || item.visual.startsWith('data:')) {
                visualHTML = `<div class="product-visual-container mini-visual image-visual"><img src="${item.visual}" alt="${item.title}" class="product-img"></div>`;
            } else {
                visualHTML = `<div class="product-visual-container mini-visual"><i data-lucide="${item.visual}" class="product-icon"></i></div>`;
            }
        }

        card.innerHTML = `<div style="display:flex; gap:1rem; align-items:center;">${visualHTML}<div class="product-info-top" style="flex-direction: column; flex:1;"><h3>${item.title}</h3><span style="color:var(--text-secondary); margin-bottom: 0.5rem">Holds: ${item.reservedTokens?item.reservedTokens.length:0} active</span></div></div><div class="controls-row"><button class="huge-btn" onclick="toggleStock(${item.id})">${stockToggleText}</button><button class="huge-btn" onclick="toggleBatchDrawer(${item.id})">Batch...</button><button class="huge-btn" onclick="toggleFlashSale(${item.id})">${item.flashSaleActive ? 'End Flash' : 'Flash'}</button><button class="huge-btn" style="background: var(--accent-orange); color: white;" onclick="logSale(${item.id})"><i data-lucide="indian-rupee"></i> Log Sale</button></div><div id="batch-drawer-${item.id}" class="timer-drawer" style="display:none;"><button class="timer-btn" onclick="startBatchTimer(${item.id}, 10)">10m</button><button class="timer-btn" onclick="startBatchTimer(${item.id}, 30)">30m</button><button class="timer-btn" onclick="startBatchTimer(${item.id}, 60)">60m</button></div>`;
        list.appendChild(card);
    });
    lucide.createIcons();
}

/* ================= ADMIN VIEW ================= */
function renderAdminView() {
    const incElem = document.getElementById("admin-total-income");
    const soldElem = document.getElementById("admin-total-sold");
    const custBody = document.getElementById("admin-customers-table");
    const vendBody = document.getElementById("admin-vendors-table");
    if(incElem) incElem.innerText = formatCurrency(platformMetrics.totalIncome);
    if(soldElem) soldElem.innerText = platformMetrics.salesHistory.length;

    if(custBody) {
        custBody.innerHTML = "";
        customersArray.forEach(c => {
            custBody.innerHTML += `<tr style="border-bottom: 1px solid rgba(255,255,255,0.1);"><td style="padding: 1rem;">${c.name}<br><small>${c.email}</small></td><td style="padding: 1rem;">${formatCurrency(c.walletBalance)}</td><td style="padding: 1rem; color: var(--accent-blue);">${formatCurrency(c.totalSpent)}</td></tr>`;
        });
    }
    if(vendBody) {
        vendBody.innerHTML = "";
        vendorsArray.forEach(v => {
            vendBody.innerHTML += `<tr style="border-bottom: 1px solid rgba(255,255,255,0.1);"><td style="padding: 1rem;">${v.shopName}<br><small>${v.name}</small></td><td style="padding: 1rem;">${v.phoneNumber}</td><td style="padding: 1rem; color: var(--accent-green);">${formatCurrency(v.totalGenerated)}</td></tr>`;
        });
    }
    lucide.createIcons();
}

/* ================= ACTIONS ================= */
window.logSale = async function(id) {
    await loadStore();
    const item = storeItems.find(i => i.id === id);
    if (!item) return;
    platformMetrics.totalIncome += item.price;
    platformMetrics.salesHistory.push({ title: item.title, vendor: item.vendorName, price: item.price, timestamp: Date.now() });
    if(currentUser) currentUser.totalGenerated = (currentUser.totalGenerated || 0) + item.price;
    await saveStore();
    showToast(`Sale Logged: +${formatCurrency(item.price)}`);
    reRenderActive();
}

window.reserveItem = async function(id) {
    await loadStore();
    const item = storeItems.find(i => i.id === id);
    if (!item || item.status !== 'IN_STOCK' || !currentUser) return;
    if((currentUser.walletBalance || 0) < item.price) return showToast("Insufficient Balance!");
    currentUser.walletBalance -= item.price;
    currentUser.totalSpent = (currentUser.totalSpent || 0) + item.price;
    const token = { code: generateHoldCode(), expires: Date.now() + (30 * 60 * 1000), ownerEmail: currentUser.email };
    if(!item.reservedTokens) item.reservedTokens = [];
    item.reservedTokens.push(token);
    await saveStore();
    showToast(`Purchase Successful!`);
    reRenderActive();
}

window.toggleStock = async function(id) {
    await loadStore();
    const item = storeItems.find(i => i.id === id);
    if (item) {
        item.status = (item.status === 'IN_STOCK' || item.status === 'TIMER') ? 'SOLD_OUT' : 'IN_STOCK';
        if(item.status === 'SOLD_OUT') item.timerTarget = null;
        await saveStore();
        reRenderActive();
    }
}

window.toggleFlashSale = async function(id) {
    await loadStore();
    const item = storeItems.find(i => i.id === id);
    if (item) {
        if (item.flashSaleActive) { item.flashSaleActive = false; item.price = item.originalPrice; }
        else { item.flashSaleActive = true; item.price = item.originalPrice * 0.8; }
        await saveStore();
        reRenderActive();
    }
}

window.startBatchTimer = async function(id, minutes) {
    await loadStore();
    const item = storeItems.find(i => i.id === id);
    if (item) {
        item.status = 'TIMER'; item.timerTarget = Date.now() + (minutes * 60000); 
        await saveStore(); reRenderActive(); showToast(`Timer synced.`);
    }
}

async function tickTimers() {
    let mutated = false;
    storeItems.forEach(item => {
        if (item.status === 'TIMER' && item.timerTarget) {
            if (Date.now() >= item.timerTarget) { item.status = 'IN_STOCK'; item.timerTarget = null; mutated = true; }
            else {
                const displays = document.querySelectorAll(`.timer-display-${item.id}`);
                const timeLeftSecs = Math.max(0, Math.ceil((item.timerTarget - Date.now()) / 1000));
                displays.forEach(d => { d.innerText = Math.ceil(timeLeftSecs/60); }); 
            }
        }
    });
    if (mutated) { await saveStore(); reRenderActive(); }
}

window.addNewItem = () => document.getElementById("add-item-modal").classList.remove("hidden");
window.closeAddModal = () => document.getElementById("add-item-modal").classList.add("hidden");
window.saveNewItem = async function() {
    await loadStore();
    const name = document.getElementById("new-item-name").value.trim();
    const price = parseFloat(document.getElementById("new-item-price").value.trim());
    const visual = document.getElementById("new-item-visual").value.trim();
    if (!name || isNaN(price) || !currentUser) return showToast("Invalid inputs.");
    storeItems.push({ id: Date.now(), title: name, vendorEmail: currentUser.email, vendorName: currentUser.shopName || currentUser.name, vendorPhone: currentUser.phoneNumber || 'Private', price, originalPrice: price, visual, status: 'IN_STOCK', timerTarget: null, flashSaleActive: false, reservedTokens: [] });
    await saveStore(); closeAddModal(); showToast(`Added ${name}!`); reRenderActive();
}

function showToast(msg) {
    const container = document.getElementById("toast-container");
    if(!container) return;
    const toast = document.createElement("div");
    toast.className = "toast";
    toast.innerHTML = `<span>${msg}</span>`;
    container.appendChild(toast);
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
