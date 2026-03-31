// Master Application Logic - Firebase Cloud Version
import { auth, db } from './firebase-config.js';
import { 
    onAuthStateChanged, signOut 
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { 
    collection, doc, onSnapshot, setDoc, updateDoc, deleteDoc, 
    getDoc, increment, arrayUnion, arrayRemove, query, where, serverTimestamp,
    addDoc, orderBy
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

let storeItems = [];
let platformMetrics = { totalIncome: 0, salesHistory: [], supportTickets: [] };
let ordersArray = [];
let customersArray = [];
let vendorsArray = [];
let currentUser = null; 
let searchQuery = ""; 
let cameraStream = null;
let supportTicketsArray = []; // New state for dedicated collection

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
    
    // 5. Listen to Support Tickets (Dedicated Collection)
    const ticketsQuery = query(collection(db, "supportTickets"), orderBy("timestamp", "desc"));
    onSnapshot(ticketsQuery, (snapshot) => {
        supportTicketsArray = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
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
        // Check if this is an admin session (admin has no Firebase account)
        const session = localStorage.getItem('digitalStreetSession');
        const isAdminAuth = localStorage.getItem('adminAuthenticated') === 'true';
        
        if (session && isAdminAuth) {
            // Admin session — load from localStorage and allow access
            currentUser = JSON.parse(session);
            updateHeaderUI();
            reRenderActive();
            return;
        }

        currentUser = null;
        localStorage.removeItem('digitalStreetSession');
        const isPublicPage = window.location.pathname.includes('index.html') || 
                             window.location.pathname.includes('admin_login.html') ||
                             window.location.pathname === '/' ||
                             window.location.pathname.endsWith('/');
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

// Premium Mouse Parallax Effect
document.addEventListener('mousemove', (e) => {
    const x = e.clientX / window.innerWidth;
    const y = e.clientY / window.innerHeight;
    
    const moveX = (x - 0.5) * 40;
    const moveY = (y - 0.5) * 40;
    
    const bg = document.querySelector('.mesh-bg');
    if (bg) {
        bg.style.transform = `translate(${moveX}px, ${moveY}px) scale(1.1)`;
    }
});

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
    localStorage.removeItem('adminAuthenticated');
    signOut(auth).then(() => {
        window.location.href = 'index.html';
    }).catch(() => {
        // Admin has no Firebase account, just redirect
        localStorage.removeItem('digitalStreetSession');
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
        await addDoc(collection(db, "supportTickets"), ticket);
        showToast("Ticket Submitted!");
        document.getElementById("support-issue").value = "";
        closeSupportModal();
    } catch (e) { showToast("Error submitting ticket."); console.error(e); }
}

/* ================= CUSTOMER VIEW ================= */
function renderCustomerView() {
    const balanceElem = document.getElementById("customer-wallet-balance");
    if (balanceElem && currentUser) balanceElem.innerText = formatCurrency(currentUser.walletBalance || 0);

    const list = document.getElementById("customer-product-list");
    const ordersList = document.getElementById("customer-orders-list");
    const banner = document.getElementById("offers-banner");
    const bannerContainer = document.getElementById("offers-banner-container");
    if (!list) return;

    // Render Products logic (Keep as is)

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

    filteredItems.forEach((item, index) => {
        const card = document.createElement("div");
        card.className = "product-card glass-panel";
        card.style.animationDelay = `${index * 0.05}s`;
        
        // Find vendor status from vendorsArray
        const vendor = vendorsArray.find(v => v.email === item.vendorEmail);
        const isShopLive = vendor ? (vendor.isLive !== false) : true; // Default to true
        const shopStatusHTML = isShopLive 
            ? `<span class="badge badge-live" style="font-size:0.6rem; padding: 0.1rem 0.4rem;"><div class="status-dot live" style="width:6px; height:6px;"></div> LIVE</span>`
            : `<span class="badge badge-off" style="font-size:0.6rem; padding: 0.1rem 0.4rem;"><div class="status-dot off" style="width:6px; height:6px;"></div> OFF</span>`;

        const vendorContactHTML = `<div style="display:flex; align-items:center; gap:0.4rem; justify-content:center; font-size: 0.75rem; color: var(--text-secondary); margin-top: 0.25rem;">${item.vendorName} ${shopStatusHTML}</div>`;

        const getValidIcon = (name) => {
            const map = { 'tulips': 'flower', 'sunflower': 'flower', 'flower-2': 'flower', 'shop': 'store' };
            return map[name.toLowerCase()] || name || 'package';
        };

        let visualHTML = `<div class="product-visual-container"><i data-lucide="${getValidIcon('package')}" class="product-icon"></i></div>`;
        if (item.visual) {
            if (item.visual.startsWith('http') || item.visual.startsWith('data:')) visualHTML = `<div class="product-visual-container image-visual"><img src="${item.visual}" class="product-img"></div>`;
            else visualHTML = `<div class="product-visual-container"><i data-lucide="${getValidIcon(item.visual)}" class="product-icon"></i></div>`;
        }

        let priceHTML = `<div style="color:var(--accent-orange); font-weight:800; font-size:1.2rem;">${formatCurrency(item.price)}</div>`;
        if (item.flashSaleActive) priceHTML = `<div style="display:flex; align-items:center; gap:0.5rem; justify-content:center;"><small style="text-decoration:line-through; color:var(--text-secondary);">${formatCurrency(item.originalPrice)}</small><span style="color:var(--accent-orange); font-weight:800; font-size:1.2rem;">${formatCurrency(item.price)}</span></div>`;
        
        let reserveHTML = "";
        if (item.status === 'IN_STOCK') {
            if (!isShopLive) {
                reserveHTML = `<button class="primary-btn" style="width:100%; justify-content:center; opacity:0.5; background:var(--panel-border);" disabled>SHOP CLOSED</button>`;
            } else {
                // Payment Method Selector
                const balance = currentUser?.walletBalance || 0;
                const canAffordWallet = balance >= item.price;
                
                reserveHTML = `
                    <div class="payment-selector" style="display:flex; background:rgba(255,255,255,0.05); border-radius:8px; padding:2px; margin-bottom:0.75rem;">
                        <button id="pay-wallet-${item.id}" class="pay-toggle-btn active" onclick="setPaymentMethod('${item.id}', 'WALLET')">Wallet</button>
                        <button id="pay-cash-${item.id}" class="pay-toggle-btn" onclick="setPaymentMethod('${item.id}', 'CASH')">Cash</button>
                    </div>
                    <button id="buy-btn-${item.id}" class="primary-btn" style="width:100%; justify-content:center; background:var(--accent-orange); color:white;" onclick="reserveItem('${item.id}')">BUY NOW</button>
                    <div id="wallet-warning-${item.id}" style="font-size:0.65rem; color:var(--accent-red); margin-top:0.4rem; text-align:center; height:12px; ${canAffordWallet ? 'display:none;' : ''}">Low balance. Please top up or use Cash.</div>
                `;
            }
        } else {
            reserveHTML = `<button class="btn-reserve" style="background:#ddd; color:#999;" disabled>SOLD OUT</button>`;
        }

        const myTokens = item.reservedTokens ? item.reservedTokens.filter(rt => rt.ownerEmail === currentUser?.email) : [];
        if (myTokens.length > 0) {
            const lastToken = myTokens[myTokens.length - 1];
            const tokenDisplay = `<div class="code-reveal" style="margin-top:1rem;"><h4>Pickup Code</h4><div class="code" style="font-size:1.5rem;">${lastToken.code}</div><button class="primary-btn" style="background:var(--accent-red); margin-top:0.5rem; width:100%; justify-content:center; font-size:0.75rem;" onclick="cancelOrder('${item.id}', '${lastToken.code}')">Cancel & Refund</button></div>`;
            card.innerHTML = `${visualHTML}<div class="product-info-top"><h3>${item.title}</h3>${vendorContactHTML}${priceHTML}</div><div class="reserve-btn-container">${tokenDisplay}</div>`;
        } else {
            card.innerHTML = `${visualHTML}<div class="product-info-top"><h3>${item.title}</h3>${vendorContactHTML}${priceHTML}</div><div class="reserve-btn-container">${reserveHTML}</div>`;
        }
        list.appendChild(card);
    });

    // Populate My Orders Section
    if (ordersList) {
        const myOrders = ordersArray.filter(o => o.customerEmail === currentUser?.email);
        if (myOrders.length === 0) {
            ordersList.innerHTML = `<div style="grid-column: 1/-1; text-align:center; padding: 2.5rem; border: 1px dashed rgba(255,255,255,0.1); border-radius: 12px; color:var(--text-secondary); background: rgba(255,255,255,0.02);">You haven't placed any orders yet.</div>`;
        } else {
            ordersList.innerHTML = myOrders.slice().reverse().map((order, index) => {
                let statusColor = "var(--text-secondary)";
                if (order.status === 'COMPLETED') statusColor = "var(--accent-green)";
                if (order.status === 'CANCELLED') statusColor = "var(--accent-red)";
                
                const isPending = order.status === 'PENDING';
                const otpBlock = isPending 
                    ? `<div style="margin-top: 1rem; padding: 0.75rem; background: rgba(59, 130, 246, 0.1); border-radius: 8px; text-align:center; border: 1px solid rgba(59, 130, 246, 0.3);">
                         <small style="text-transform:uppercase; font-size:0.6rem; color:var(--accent-blue); display:block; margin-bottom:0.25rem; font-weight:700;">Pickup OTP</small>
                         <span style="font-size: 1.5rem; font-weight:800; letter-spacing:4px; color:white;">${order.pickup_code}</span>
                       </div>`
                    : `<div style="margin-top: 1rem; color: ${statusColor}; font-weight:700; font-size:0.8rem; text-transform:uppercase; letter-spacing:1px; text-align:center; padding: 0.5rem; background:rgba(255,255,255,0.05); border-radius:8px;">${order.status}</div>`;

                const cancelBtn = isPending 
                    ? `<button class="primary-btn" style="background: rgba(239, 68, 68, 0.1); color: var(--accent-red); font-size:0.75rem; border:1px solid rgba(239, 68, 68, 0.2); padding:0.5rem; width:100%; height:auto; margin-top:1rem; border-radius:8px;" onclick="cancelOrder('${order.item_id}', '${order.pickup_code}')">Cancel & Refund</button>`
                    : "";

                return `
                <div class="glass-panel" style="padding: 1.5rem; display:flex; flex-direction:column; justify-content:space-between; border-color: ${isPending ? 'rgba(59, 130, 246, 0.4)' : 'rgba(255,255,255,0.05)'}; transition: transform 0.3s ease; animation: fadeInUp 0.8s cubic-bezier(0.16, 1, 0.3, 1) both; animation-delay: ${index * 0.05}s;">
                    <div>
                        <div style="display:flex; justify-content:space-between; align-items:start; margin-bottom: 0.5rem;">
                            <h4 style="margin:0; font-size:1.1rem; font-weight:700;">${order.title}</h4>
                            <span style="font-weight:800; color:var(--accent-green); font-size:1rem;">${formatCurrency(order.price)}</span>
                        </div>
                        <div style="font-size:0.8rem; color:var(--text-secondary); line-height:1.4;">
                            <span style="display:flex; align-items:center; gap:0.3rem;"><i data-lucide="store" style="width:12px; height:12px;"></i> ${order.vendor}</span>
                            <span style="display:flex; align-items:center; gap:0.3rem; margin-top:0.2rem;"><i data-lucide="credit-card" style="width:12px; height:12px;"></i> Paid via: <strong style="color:var(--accent-orange); ml-1">${order.paymentMethod || 'WALLET'}</strong></span>
                        </div>
                        ${otpBlock}
                    </div>
                    ${cancelBtn}
                </div>`;
            }).join("");
        }
    }
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

    const currentBalance = currentUser.walletBalance || 0;
    if (currentBalance + depositAmt > 10000) {
        return showToast(`Limit Exceeded! Maximum balance allowed is ₹10,000. Your current balance is ${formatCurrency(currentBalance)}.`);
    }
    
    try {
        await updateDoc(doc(db, "users", currentUser.email), {
            walletBalance: increment(depositAmt)
        });
        showToast(`₹${depositAmt.toLocaleString()} added!`);
        closeAddFundsModal();
    } catch (e) { showToast("Transaction failed."); }
}

/* ================= VENDOR VIEW ================= */
window.toggleShopStatus = async function() {
    if (!currentUser) return;
    const currentStatus = currentUser.isLive !== false;
    const newStatus = !currentStatus;
    
    try {
        await updateDoc(doc(db, "users", currentUser.email), {
            isLive: newStatus
        });
        showToast(`Shop is now ${newStatus ? 'LIVE' : 'OFF'}`);
    } catch (e) {
        showToast("Error updating shop status.");
        console.error(e);
    }
}

function renderVendorView() {
    const salesElem = document.getElementById("vendor-daily-sales");
    if (salesElem && currentUser) salesElem.innerText = formatCurrency(currentUser.totalGenerated || 0);

    // Render Shop Status Toggle
    const toggleContainer = document.getElementById("shop-status-toggle-container");
    if (toggleContainer && currentUser) {
        const isLive = currentUser.isLive !== false;
        toggleContainer.innerHTML = `
            <button class="status-toggle-btn ${isLive ? 'live' : 'off'}" onclick="toggleShopStatus()">
                <div class="status-dot ${isLive ? 'live' : 'off'}"></div>
                Shop: ${isLive ? 'LIVE' : 'OFF'}
            </button>
        `;
    }

    const list = document.getElementById("vendor-product-list");
    if (!list) return;
    list.innerHTML = "";
    const myItems = storeItems.filter(i => i.vendorEmail === currentUser?.email);
    if(myItems.length === 0) list.innerHTML = "<div style='text-align:center; padding: 2rem; color:var(--text-secondary);'>None listed yet.</div>";

    myItems.forEach((item, index) => {
        const card = document.createElement("div");
        card.className = "vendor-item-card glass-panel";
        card.style.animation = `fadeInUp 0.8s cubic-bezier(0.16, 1, 0.3, 1) both ${index * 0.05}s`;
        const isStocked = item.status === 'IN_STOCK';
        let toggleText = isStocked ? "Set Sold Out" : "Set In Stock";

        let visualHTML = `<div class="product-visual-container mini-visual"><i data-lucide="package" class="product-icon"></i></div>`;
        if (item.visual) {
            if (item.visual.startsWith('http')) visualHTML = `<div class="product-visual-container mini-visual image-visual"><img src="${item.visual}" class="product-img"></div>`;
            else visualHTML = `<div class="product-visual-container mini-visual"><i data-lucide="${item.visual}" class="product-icon"></i></div>`;
        }

        const activeHolds = (item.reservedTokens || []).length;
        const btnStyle = activeHolds > 0 ? "background: var(--accent-orange); color: white;" : "opacity:0.3; cursor:not-allowed;";

        card.innerHTML = `<div style="display:flex; gap:1rem; align-items:center;">${visualHTML}<div class="product-info-top" style="flex-direction: column; flex:1;"><h3>${item.title}</h3><span style="color:var(--text-secondary); margin-bottom: 0.5rem">Holds: ${activeHolds} active</span></div></div><div class="controls-row"><button class="huge-btn" onclick="toggleStock('${item.id}')">${toggleText}</button><button class="huge-btn" onclick="toggleFlashSale('${item.id}')">${item.flashSaleActive ? 'End Flash' : 'Flash Sale'}</button><button class="huge-btn" style="${btnStyle}" ${activeHolds > 0 ? '' : 'disabled'} onclick="${activeHolds > 0 ? `openPickupModal('${item.id}')` : `showNoHoldsToast()`}"><i data-lucide="shield-check"></i> Verify Pickup</button></div>`;
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
            
            const methodHTML = order.paymentMethod === 'CASH' 
                ? `<span style="font-size:0.6rem; background:rgba(192, 140, 93, 0.15); color:var(--accent-orange); padding:0.1rem 0.3rem; border-radius:4px; font-weight:700;">CASH</span>`
                : `<span style="font-size:0.6rem; background:rgba(59, 130, 246, 0.15); color:var(--accent-blue); padding:0.1rem 0.3rem; border-radius:4px; font-weight:700;">WALLET</span>`;

            return `<tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
                <td style="padding: 0.75rem;">${time}</td>
                <td style="padding: 0.75rem;">${order.title}<br><small style="color:${statusColor}">${order.status}</small></td>
                <td style="padding: 0.75rem;">${order.vendor}<br>${methodHTML}</td>
                <td style="padding: 0.75rem; color: var(--accent-green); font-weight:700;">${formatCurrency(order.price)}</td>
            </tr>`;
        }).join("");
    }

    if(suppBody) {
        suppBody.innerHTML = supportTicketsArray.map(t => `<tr style="border-bottom: 1px solid rgba(255,255,255,0.05);"><td style="padding: 1rem;"><strong>${t.user}</strong></td><td style="padding: 1rem; color: var(--text-secondary);">${t.issue}</td><td style="padding: 1rem; text-align:right;"><button class="logout-btn" onclick="resolveTicket('${t.id}')">Resolve</button></td></tr>`).join("");
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
    try {
        await deleteDoc(doc(db, "supportTickets", id));
        showToast("Ticket Resolved.");
    } catch (e) { showToast("Error resolving ticket."); }
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
        
        const methodNote = matchingOrders[0]?.paymentMethod === 'CASH' ? " Collect Cash Now!" : " Paid via Wallet.";
        showToast("Pickup Verified!" + methodNote);
        closePickupModal();
    } else { showToast("Invalid Code!"); }
}

let selectedPaymentMethods = {}; // State for UI toggles

window.setPaymentMethod = function(itemId, method) {
    selectedPaymentMethods[itemId] = method;
    const item = storeItems.find(i => i.id === itemId);
    const buyBtn = document.getElementById(`buy-btn-${itemId}`);
    const walletWarning = document.getElementById(`wallet-warning-${itemId}`);
    const walletBtn = document.getElementById(`pay-wallet-${itemId}`);
    const cashBtn = document.getElementById(`pay-cash-${itemId}`);
    
    // UI Feedback
    if(walletBtn) walletBtn.classList.toggle('active', method === 'WALLET');
    if(cashBtn) cashBtn.classList.toggle('active', method === 'CASH');

    if(method === 'WALLET') {
        const canAfford = (currentUser.walletBalance || 0) >= item.price;
        if(buyBtn) {
            buyBtn.disabled = !canAfford;
            buyBtn.style.opacity = canAfford ? '1' : '0.5';
        }
        if(walletWarning) walletWarning.style.display = canAfford ? 'none' : 'block';
    } else {
        // Cash always allowed
        if(buyBtn) {
            buyBtn.disabled = false;
            buyBtn.style.opacity = '1';
        }
        if(walletWarning) walletWarning.style.display = 'none';
    }
}

window.reserveItem = async function(id) {
    const item = storeItems.find(i => i.id === id);
    const method = selectedPaymentMethods[id] || 'WALLET';
    
    if (!item) return;
    if (method === 'WALLET' && (currentUser.walletBalance || 0) < item.price) return showToast("Insufficient Balance!");
    
    const pickupCode = generateHoldCode();
    const token = { code: pickupCode, expires: Date.now() + (30 * 60 * 1000), ownerEmail: currentUser.email };
    
    try {
        // 1. Deduct from Customer (Only if WALLET)
        if(method === 'WALLET') {
            await updateDoc(doc(db, "users", currentUser.email), {
                walletBalance: increment(-item.price),
                totalSpent: increment(item.price)
            });
        }

        // 2. Add Reservation to Item
        await updateDoc(doc(db, "storeItems", id), {
            reservedTokens: arrayUnion(token)
        });

        // 3. Create a Permanent Order Record
        await addDoc(collection(db, "orders"), {
            item_id: id,
            title: item.title,
            price: item.price,
            vendor: item.vendorName,
            vendorEmail: item.vendorEmail,
            customerEmail: currentUser.email,
            customerName: currentUser.name,
            pickup_code: pickupCode,
            paymentMethod: method, // NEW FIELD
            status: 'PENDING',
            timestamp: Date.now()
        });

        showToast(method === 'WALLET' ? "Purchase Successful!" : "Reserved for Cash Pickup!");
    } catch(e) { showToast("Reservation failed."); console.error(e); }
}

window.cancelOrder = async function(itemId, code) {
    const item = storeItems.find(i => i.id === itemId);
    if(!item) return;
    const token = item.reservedTokens.find(t => t.code === code && t.ownerEmail === currentUser.email);
    if(!token) return;

    // Find the specific order to check payment method
    const order = ordersArray.find(o => o.item_id === itemId && o.pickup_code === code && o.customerEmail === currentUser.email);

    try {
        // 1. Refund Customer (Only if WALLET)
        if(order && order.paymentMethod === 'WALLET') {
            await updateDoc(doc(db, "users", currentUser.email), {
                walletBalance: increment(item.price),
                totalSpent: increment(-item.price)
            });
        }

        // 2. Remove Token from Item
        await updateDoc(doc(db, "storeItems", itemId), {
            reservedTokens: arrayRemove(token)
        });

        // 3. Update Order Status
        if(order) {
            await updateDoc(doc(db, "orders", order.id), {
                status: 'CANCELLED',
                cancelledAt: Date.now()
            });
        }

        showToast(order?.paymentMethod === 'WALLET' ? "Order Cancelled & Refunded." : "Cash Order Cancelled.");
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
    let visual = document.getElementById("new-item-visual").value.trim();
    
    const photoPreview = document.getElementById("photo-preview");
    if(photoPreview && photoPreview.src && !photoPreview.src.endsWith('vendor.html')) {
        visual = photoPreview.src;
    }

    if (!name || isNaN(price)) return showToast("Invalid inputs.");

    const id = Date.now().toString();
    const newItem = { 
        title: name, vendorEmail: currentUser.email, vendorName: currentUser.shopName || currentUser.name, 
        vendorPhone: currentUser.phoneNumber || 'Private', price, originalPrice: price, 
        visual, status: 'IN_STOCK', flashSaleActive: false, reservedTokens: [] 
    };
    
    await setDoc(doc(db, "storeItems", id), newItem);
    clearPhoto(); // Reset camera UI
    closeAddModal();
    showToast(`Added ${name}!`);
}

/* ================= CAMERA LOGIC ================= */
window.startCamera = async function() {
    const container = document.getElementById("camera-container");
    const video = document.getElementById("camera-video");
    const previewContainer = document.getElementById("photo-preview-container");

    if (previewContainer) previewContainer.classList.add("hidden");
    
    try {
        cameraStream = await navigator.mediaDevices.getUserMedia({ 
            video: { facingMode: 'environment' }, 
            audio: false 
        });
        video.srcObject = cameraStream;
        container.classList.remove("hidden");
        lucide.createIcons();
    } catch (err) {
        console.error("Camera error:", err);
        showToast("Could not access camera.");
    }
}

window.stopCamera = function() {
    if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
        cameraStream = null;
    }
    const container = document.getElementById("camera-container");
    if (container) container.classList.add("hidden");
}

window.capturePhoto = function() {
    const video = document.getElementById("camera-video");
    const canvas = document.getElementById("camera-canvas");
    const preview = document.getElementById("photo-preview");
    const previewContainer = document.getElementById("photo-preview-container");
    const visualInput = document.getElementById("new-item-visual");

    if (!video || !canvas) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);

    const dataUrl = canvas.toDataURL('image/png');
    preview.src = dataUrl;
    previewContainer.classList.remove("hidden");
    
    // Clear the input if photo is taken
    visualInput.value = "Photo Captured";
    visualInput.disabled = true;

    stopCamera();
    showToast("Photo captured!");
}

window.clearPhoto = function() {
    const preview = document.getElementById("photo-preview");
    const previewContainer = document.getElementById("photo-preview-container");
    const visualInput = document.getElementById("new-item-visual");

    if (preview) preview.src = "";
    if (previewContainer) previewContainer.classList.add("hidden");
    if (visualInput) {
        visualInput.value = "";
        visualInput.disabled = false;
    }
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
window.showNoHoldsToast = () => showToast("No pending orders to verify.");
