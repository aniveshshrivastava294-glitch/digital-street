// Master Application Logic - Firebase Cloud Version
import { auth, db } from './firebase-config.js';
import { 
    onAuthStateChanged, signOut 
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { 
    collection, doc, onSnapshot, setDoc, updateDoc, deleteDoc, 
    getDoc, increment, arrayUnion, arrayRemove, query, where, serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

let storeItems = [];
let platformMetrics = { totalIncome: 0, salesHistory: [], supportTickets: [] };
let ordersArray = [];
let customersArray = [];
let vendorsArray = [];
let currentUser = null; 
let searchQuery = ""; 

// 🚀 Real-time Firestore Listeners
function initFirebaseListeners() {
    // 1. Listen to Store Items
    onSnapshot(collection(db, "storeItems"), (snapshot) => {
        storeItems = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        reRenderActive();
    });

    // 2. Listen to Platform Metrics
    onSnapshot(doc(db, "config", "platformMetrics"), (snapshot) => {
        if (snapshot.exists()) {
            platformMetrics = snapshot.data();
            reRenderActive();
        } else {
            // Initialize if missing
            setDoc(doc(db, "config", "platformMetrics"), { totalIncome: 0, salesHistory: [], supportTickets: [] });
        }
    });

    // 3. Listen to Orders (for Admin & User views)
    onSnapshot(collection(db, "orders"), (snapshot) => {
        ordersArray = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        reRenderActive();
    });

    // 4. Listen to Users (for Admin View)
    onSnapshot(collection(db, "users"), (snapshot) => {
        const allUsers = snapshot.docs.map(doc => ({ ...doc.data(), email: doc.id }));
        customersArray = allUsers.filter(u => u.role === 'CUSTOMER');
        vendorsArray = allUsers.filter(u => u.role === 'VENDOR');
        
        // Sync currentUser if updated in DB
        if (currentUser) {
            const fresh = allUsers.find(u => u.email === currentUser.email);
            if (fresh) {
                currentUser = fresh;
                localStorage.setItem('digitalStreetSession', JSON.stringify(currentUser));
                updateHeaderUI();
            }
        }
        reRenderActive();
    });
}

function updateHeaderUI() {
    if(currentUser) {
        const headerName = document.getElementById('user-display-name');
        if(headerName) {
            headerName.innerText = currentUser.role === 'VENDOR' ? (currentUser.shopName || currentUser.name) : currentUser.name;
        }
    }
}

// 🔐 Auth Observer
onAuthStateChanged(auth, async (user) => {
    if (user) {
        const userDoc = await getDoc(doc(db, "users", user.email));
        if (userDoc.exists()) {
            currentUser = { ...userDoc.data(), email: user.email };
            localStorage.setItem('digitalStreetSession', JSON.stringify(currentUser));
            updateHeaderUI();
            reRenderActive();
        }
    } else {
        currentUser = null;
        localStorage.removeItem('digitalStreetSession');
        // Protection logic handled by individual HTML files or here
        const isPublicPage = window.location.pathname.includes('index.html') || window.location.pathname.includes('admin_login.html');
        if (!isPublicPage) window.location.href = 'index.html';
    }
});

const formatCurrency = (amt) => "₹" + (amt || 0).toFixed(2);
const generateHoldCode = () => Math.floor(1000 + Math.random() * 9000).toString();

window.initApp = async function() {
    lucide.createIcons();
    initFirebaseListeners();
    setInterval(tickTimers, 1000);
};

// Auto-init for modules
initApp();

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
        name: document.getElementById("profile-name").value.trim(),
    };
    if(currentUser.role === 'VENDOR') {
        payload.shopName = document.getElementById("profile-shopname").value.trim();
        payload.phoneNumber = document.getElementById("profile-phone").value.trim();
    }
    try {
        await updateDoc(doc(db, "users", currentUser.email), payload);
        
        // Update associated store items if vendor
        if (currentUser.role === 'VENDOR') {
            storeItems.forEach(async (item) => {
                if (item.vendorEmail === currentUser.email) {
                    await updateDoc(doc(db, "storeItems", item.id), {
                        vendorName: payload.shopName || payload.name,
                        vendorPhone: payload.phoneNumber
                    });
                }
            });
        }
        
        showToast("Profile Updated!");
        closeProfileModal();
    } catch(e) { showToast("Error updating profile."); }
}

window.logout = function() {
    signOut(auth).then(() => {
        window.location.href = 'index.html';
    });
}

/* ================= SEARCH LOGIC ================= */
window.handleSearch = function(val) {
    searchQuery = val.toLowerCase().trim();
    renderCustomerView();
}

/* ================= SUPPORT LOGIC ================= */
window.submitSupportTicket = async function() {
    const issue = document.getElementById("support-issue").value.trim();
    if(!issue) return showToast("Please describe your issue.");
    
    const ticket = {
        id: Date.now(),
        user: currentUser.name,
        email: currentUser.email,
        issue: issue,
        timestamp: Date.now(),
        status: 'OPEN'
    };
    
    try {
        await updateDoc(doc(db, "config", "platformMetrics"), {
            supportTickets: arrayUnion(ticket)
        });
        showToast("Ticket Submitted!");
        document.getElementById("support-issue").value = "";
        closeSupportModal();
    } catch (e) { showToast("Error submitting ticket."); }
}

/* ================= CUSTOMER VIEW ================= */
function renderCustomerView() {
    const balanceElem = document.getElementById("customer-wallet-balance");
    if (balanceElem && currentUser) balanceElem.innerText = formatCurrency(currentUser.walletBalance || 0);

    const list = document.getElementById("customer-product-list");
    const banner = document.getElementById("offers-banner");
    const bannerContainer = document.getElementById("offers-banner-container");
    if (!list) return;

    const filteredItems = storeItems.filter(item => {
        const matchesSearch = item.title.toLowerCase().includes(searchQuery) || 
                             item.vendorName.toLowerCase().includes(searchQuery);
        return matchesSearch;
    });

    const flashSales = storeItems.filter(item => item.flashSaleActive && item.status === 'IN_STOCK');
    if (flashSales.length > 0 && searchQuery === "") {
        bannerContainer.classList.remove("hidden");
        banner.innerHTML = "";
        flashSales.forEach(item => {
            const div = document.createElement("div");
            div.className = "banner-item";
            let visualHTML = `<div class="banner-visual"><i data-lucide="package" class="product-icon"></i></div>`;
            if (item.visual) {
                if (item.visual.startsWith('http')) visualHTML = `<div class="banner-visual"><img src="${item.visual}" class="product-img"></div>`;
                else visualHTML = `<div class="banner-visual"><i data-lucide="${item.visual}" class="product-icon"></i></div>`;
            }

            div.innerHTML = `<div class="offer-badge">Sale</div>${visualHTML}<div class="banner-info"><h4 style="margin:0; font-size:0.9rem;">${item.title}</h4><div style="color:var(--accent-orange); font-weight:700;">${formatCurrency(item.price)}</div><small style="color:var(--text-secondary); font-size:0.7rem;">${item.vendorName}</small></div>`;
            div.onclick = () => {
                const searchInput = document.getElementById("search-input");
                if(searchInput) { searchInput.value = item.title; handleSearch(item.title); }
            };
            banner.appendChild(div);
        });
    } else {
        if(bannerContainer) bannerContainer.classList.add("hidden");
    }

    list.innerHTML = "";
    if(filteredItems.length === 0) {
        list.innerHTML = `<div style="grid-column: 1/-1; text-align:center; padding: 3rem; color:var(--text-secondary);">No products found.</div>`;
    }

    filteredItems.forEach(item => {
        const card = document.createElement("div");
        card.className = "product-card glass-panel";
        const vendorContactHTML = `<div class="vendor-info-card" style="margin-top: 0.5rem; padding: 0.75rem; background: rgba(59, 130, 246, 0.05); border: 1px solid rgba(59, 130, 246, 0.1); border-radius: 8px;"><div style="font-size: 0.8rem; font-weight:700; color: var(--accent-blue); display:flex; align-items:center; gap:0.4rem; margin-bottom:0.2rem;"><i data-lucide="store" style="width:14px; height:14px"></i> ${item.vendorName}</div><div style="font-size: 0.75rem; color: var(--text-secondary); display:flex; align-items:center; gap:0.4rem;"><i data-lucide="phone" style="width:12px; height:12px"></i> Call: ${item.vendorPhone}</div></div>`;

        let visualHTML = `<div class="product-visual-container"><i data-lucide="package" class="product-icon"></i></div>`;
        if (item.visual) {
            if (item.visual.startsWith('http') || item.visual.startsWith('data:')) visualHTML = `<div class="product-visual-container image-visual"><img src="${item.visual}" class="product-img"></div>`;
            else visualHTML = `<div class="product-visual-container"><i data-lucide="${item.visual}" class="product-icon"></i></div>`;
        }

        let priceHTML = `<span>${formatCurrency(item.price)}</span>`;
        if (item.flashSaleActive) priceHTML = `<small>${formatCurrency(item.originalPrice)}</small><span>${formatCurrency(item.price)}</span>`;
        
        let badgeHTML = item.status === 'IN_STOCK' ? `<span class="badge badge-stock">In Stock</span>` : `<span class="badge badge-sold">Sold Out</span>`;
        if (item.flashSaleActive && item.status === 'IN_STOCK') badgeHTML += ` <span class="badge badge-flash">Flash Deal</span>`;

        let reserveHTML = "";
        if (item.status === 'IN_STOCK') {
            reserveHTML = `<button class="primary-btn" style="width:100%; margin-top:1rem; justify-content:center; background:var(--accent-green); color:black;" onclick="reserveItem('${item.id}')"><i data-lucide="shopping-cart"></i> Buy Now</button>`;
            if(currentUser && (currentUser.walletBalance || 0) < item.price) reserveHTML = `<button class="primary-btn" style="width:100%; margin-top:1rem; justify-content:center; opacity:0.5; background:var(--panel-border);" disabled>Refill Wallet</button>`;
        } else {
            reserveHTML = `<button class="btn-reserve" disabled>Not Available</button>`;
        }

        const myTokens = item.reservedTokens ? item.reservedTokens.filter(rt => rt.ownerEmail === currentUser?.email) : [];
        if (myTokens.length > 0) {
            const lastToken = myTokens[myTokens.length - 1];
            const tokenDisplay = `<div class="code-reveal"><h4>Pickup Code</h4><div class="code">${lastToken.code}</div><button class="primary-btn" style="background:var(--accent-red); margin-top:0.5rem; width:100%; justify-content:center; font-size:0.7rem;" onclick="cancelOrder('${item.id}', '${lastToken.code}')"><i data-lucide="x-circle" style="width:12px; height:12px"></i> Cancel Order & Refund</button></div>`;
            card.innerHTML = `${visualHTML}<div class="product-info-top"><div class="product-title"><h3>${item.title}</h3></div><div class="price-tag">${priceHTML}</div></div>${vendorContactHTML}<div style="margin-top: 0.5rem;">${badgeHTML}</div>${tokenDisplay}`;
        } else {
            card.innerHTML = `${visualHTML}<div class="product-info-top"><div class="product-title"><h3>${item.title}</h3></div><div class="price-tag">${priceHTML}</div></div>${vendorContactHTML}<div style="margin-top: 0.5rem;">${badgeHTML}</div>${reserveHTML}`;
        }
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
    const input = document.getElementById("wallet-deposit-amount");
    const depositAmt = parseFloat(input.value.replace(/[^0-9.]/g, ''));
    
    if (isNaN(depositAmt) || depositAmt <= 0 || !currentUser) return showToast("Invalid amount.");
    
    try {
        await updateDoc(doc(db, "users", currentUser.email), {
            walletBalance: increment(depositAmt)
        });
        showToast(`₹${depositAmt.toLocaleString()} added!`);
        closeAddFundsModal();
    } catch (e) { showToast("Transaction failed."); }
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
        let toggleText = isStocked ? "Set Sold Out" : "Set In Stock";

        let visualHTML = `<div class="product-visual-container mini-visual"><i data-lucide="package" class="product-icon"></i></div>`;
        if (item.visual) {
            if (item.visual.startsWith('http')) visualHTML = `<div class="product-visual-container mini-visual image-visual"><img src="${item.visual}" class="product-img"></div>`;
            else visualHTML = `<div class="product-visual-container mini-visual"><i data-lucide="${item.visual}" class="product-icon"></i></div>`;
        }

        const activeHolds = (item.reservedTokens || []).length;
        const btnStyle = activeHolds > 0 ? "background: var(--accent-orange); color: white;" : "opacity:0.3; cursor:not-allowed;";

        card.innerHTML = `<div style="display:flex; gap:1rem; align-items:center;">${visualHTML}<div class="product-info-top" style="flex-direction: column; flex:1;"><h3>${item.title}</h3><span style="color:var(--text-secondary); margin-bottom: 0.5rem">Holds: ${activeHolds} active</span></div></div><div class="controls-row"><button class="huge-btn" onclick="toggleStock('${item.id}')">${toggleText}</button><button class="huge-btn" onclick="toggleFlashSale('${item.id}')">${item.flashSaleActive ? 'End Flash' : 'Flash Sale'}</button><button class="huge-btn" style="${btnStyle}" onclick="activeHolds > 0 ? openPickupModal('${item.id}') : null"><i data-lucide="shield-check"></i> Verify Pickup</button></div>`;
        list.appendChild(card);
    });
    lucide.createIcons();
}

/* ================= ADMIN VIEW ================= */
function renderAdminView() {
    const incElem = document.getElementById("admin-total-income");
    const soldElem = document.getElementById("admin-total-sold");
    const ordBody = document.getElementById("admin-orders-table");
    const custBody = document.getElementById("admin-customers-table");
    const vendBody = document.getElementById("admin-vendors-table");
    const suppBody = document.getElementById("admin-support-table");
    
    if(incElem) incElem.innerText = formatCurrency(platformMetrics.totalIncome);
    if(soldElem) soldElem.innerText = ordersArray.filter(o => o.status === 'COMPLETED').length;

    if(ordBody) {
        // Display latest 5 orders regardless of status
        ordBody.innerHTML = ordersArray.slice(-10).reverse().map(order => {
            const time = new Date(order.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            let statusColor = "var(--text-secondary)";
            if(order.status === 'COMPLETED') statusColor = "var(--accent-green)";
            if(order.status === 'CANCELLED') statusColor = "var(--accent-red)";
            
            return `<tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
                <td style="padding: 0.75rem;">${time}</td>
                <td style="padding: 0.75rem;">${order.title}<br><small style="color:${statusColor}">${order.status}</small></td>
                <td style="padding: 0.75rem;">${order.vendor}</td>
                <td style="padding: 0.75rem; color: var(--accent-green); font-weight:700;">${formatCurrency(order.price)}</td>
            </tr>`;
        }).join("");
    }

    if(suppBody) {
        suppBody.innerHTML = (platformMetrics.supportTickets || []).map(t => `<tr style="border-bottom: 1px solid rgba(255,255,255,0.05);"><td style="padding: 1rem;"><strong>${t.user}</strong></td><td style="padding: 1rem; color: var(--text-secondary);">${t.issue}</td><td style="padding: 1rem; text-align:right;"><button class="logout-btn" onclick="resolveTicket(${t.id})">Resolve</button></td></tr>`).join("");
    }

    if(custBody) {
        custBody.innerHTML = customersArray.map(c => `<tr style="border-bottom: 1px solid rgba(255,255,255,0.1);"><td style="padding: 1rem;">${c.name}</td><td style="padding: 1rem;">${formatCurrency(c.walletBalance)}</td><td style="padding: 1rem; color: var(--accent-blue);">${formatCurrency(c.totalSpent)}</td></tr>`).join("");
    }
    if(vendBody) {
        vendBody.innerHTML = vendorsArray.map(v => `<tr style="border-bottom: 1px solid rgba(255,255,255,0.1);"><td style="padding: 1rem;">${v.shopName}</td><td style="padding: 1rem;">${v.phoneNumber}</td><td style="padding: 1rem; color: var(--accent-green);">${formatCurrency(v.totalGenerated)}</td></tr>`).join("");
    }
    lucide.createIcons();
}

window.resolveTicket = async function(id) {
    const freshTickets = platformMetrics.supportTickets.filter(t => t.id !== id);
    await updateDoc(doc(db, "config", "platformMetrics"), { supportTickets: freshTickets });
    showToast("Ticket Resolved.");
}

/* ================= PICKUP & RESERVE ================= */
window.openPickupModal = function(id) {
    document.getElementById("pickup-modal").classList.remove("hidden");
    document.getElementById("current-pickup-item-id").value = id;
    document.getElementById("pickup-code-input").value = "";
    document.getElementById("pickup-code-input").focus();
}
window.closePickupModal = () => document.getElementById("pickup-modal").classList.add("hidden");

window.confirmPickup = async function() {
    const itemId = document.getElementById("current-pickup-item-id").value;
    const inputCode = document.getElementById("pickup-code-input").value.trim();
    const item = storeItems.find(i => i.id === itemId);
    
    if(!item || !item.reservedTokens) return;
    const tokenIdx = item.reservedTokens.findIndex(t => t.code === inputCode);
    
    if(tokenIdx !== -1) {
        const token = item.reservedTokens[tokenIdx];
        
        // 1. Update Platform Metrics (Atomically)
        await updateDoc(doc(db, "config", "platformMetrics"), {
            totalIncome: increment(item.price)
        });

        // 2. Update Order Status
        const orderQuery = query(collection(db, "orders"), 
            where("item_id", "==", itemId), 
            where("pickup_code", "==", inputCode),
            where("status", "==", "PENDING")
        );
        // Normally you'd get the ID but let's use the code mapping
        const matchingOrders = ordersArray.filter(o => o.item_id === itemId && o.pickup_code === inputCode && o.status === 'PENDING');
        if(matchingOrders.length > 0) {
            await updateDoc(doc(db, "orders", matchingOrders[0].id), {
                status: 'COMPLETED',
                completedAt: Date.now()
            });
        }

        // 3. Update Vendor Income
        await updateDoc(doc(db, "users", item.vendorEmail), { 
            totalGenerated: increment(item.price) 
        });
        
        // 4. Clean up the token on the item
        const freshTokens = item.reservedTokens.filter((_, idx) => idx !== tokenIdx);
        await updateDoc(doc(db, "storeItems", itemId), { reservedTokens: freshTokens });
        
        showToast("Pickup Verified! Income Stored.");
        closePickupModal();
    } else { showToast("Invalid Code!"); }
}

window.reserveItem = async function(id) {
    const item = storeItems.find(i => i.id === id);
    if (!item || (currentUser.walletBalance || 0) < item.price) return showToast("Insufficient Balance!");
    
    const pickupCode = generateHoldCode();
    const token = { code: pickupCode, expires: Date.now() + (30 * 60 * 1000), ownerEmail: currentUser.email };
    
    try {
        // 1. Deduct from Customer
        await updateDoc(doc(db, "users", currentUser.email), {
            walletBalance: increment(-item.price),
            totalSpent: increment(item.price)
        });

        // 2. Add Reservation to Item
        await updateDoc(doc(db, "storeItems", id), {
            reservedTokens: arrayUnion(token)
        });

        // 3. Create a Permanent Order Record
        const orderId = "order_" + Date.now();
        await setDoc(doc(db, "orders", orderId), {
            item_id: id,
            title: item.title,
            price: item.price,
            vendor: item.vendorName,
            vendorEmail: item.vendorEmail,
            customerEmail: currentUser.email,
            customerName: currentUser.name,
            pickup_code: pickupCode,
            status: 'PENDING',
            timestamp: Date.now()
        });

        showToast("Purchase Successful! Order Recorded.");
    } catch(e) { showToast("Reservation failed."); console.error(e); }
}

window.cancelOrder = async function(itemId, code) {
    const item = storeItems.find(i => i.id === itemId);
    if(!item) return;
    const token = item.reservedTokens.find(t => t.code === code && t.ownerEmail === currentUser.email);
    if(!token) return;

    try {
        // 1. Refund Customer
        await updateDoc(doc(db, "users", currentUser.email), {
            walletBalance: increment(item.price),
            totalSpent: increment(-item.price)
        });

        // 2. Remove Token from Item
        await updateDoc(doc(db, "storeItems", itemId), {
            reservedTokens: arrayRemove(token)
        });

        // 3. Update Order Status
        const matchingOrders = ordersArray.filter(o => o.item_id === itemId && o.pickup_code === code && o.customerEmail === currentUser.email);
        if(matchingOrders.length > 0) {
            await updateDoc(doc(db, "orders", matchingOrders[0].id), {
                status: 'CANCELLED',
                cancelledAt: Date.now()
            });
        }

        showToast("Order Cancelled & Refunded.");
    } catch(e) { showToast("Cancellation failed."); }
}

/* ================= STORE OPS ================= */
window.toggleStock = async function(id) {
    const item = storeItems.find(i => i.id === id);
    if (item) {
        const newStatus = item.status === 'IN_STOCK' ? 'SOLD_OUT' : 'IN_STOCK';
        await updateDoc(doc(db, "storeItems", id), { status: newStatus });
    }
}

window.toggleFlashSale = async function(id) {
    const item = storeItems.find(i => i.id === id);
    if (item) {
        const active = !item.flashSaleActive;
        const newPrice = active ? item.originalPrice * 0.8 : item.originalPrice;
        await updateDoc(doc(db, "storeItems", id), { flashSaleActive: active, price: newPrice });
    }
}

window.addNewItem = () => document.getElementById("add-item-modal").classList.remove("hidden");
window.closeAddModal = () => document.getElementById("add-item-modal").classList.add("hidden");
window.saveNewItem = async function() {
    const name = document.getElementById("new-item-name").value.trim();
    const price = parseFloat(document.getElementById("new-item-price").value.trim());
    const visual = document.getElementById("new-item-visual").value.trim();
    if (!name || isNaN(price)) return showToast("Invalid inputs.");

    const id = Date.now().toString();
    const newItem = { 
        title: name, vendorEmail: currentUser.email, vendorName: currentUser.shopName || currentUser.name, 
        vendorPhone: currentUser.phoneNumber || 'Private', price, originalPrice: price, 
        visual, status: 'IN_STOCK', flashSaleActive: false, reservedTokens: [] 
    };
    
    await setDoc(doc(db, "storeItems", id), newItem);
    closeAddModal();
    showToast(`Added ${name}!`);
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

function tickTimers() {
    // Basic timer display logic can go here if needed
}

window.openSupportModal = () => document.getElementById("support-modal").classList.remove("hidden");
window.closeSupportModal = () => document.getElementById("support-modal").classList.add("hidden");
window.closeAddFundsModal = () => document.getElementById("add-funds-modal").classList.add("hidden");
