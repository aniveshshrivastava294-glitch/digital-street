# 🏪 Digital Street Marketplace

Digital Street is a modern neighborhood marketplace connecting local vendors directly to customers. Powered by **Google Firebase**, all data is stored securely in the cloud with real-time synchronization — no server restarts, no data loss.

---

## 🚀 Key Features

### 🔐 Firebase Authentication
- **Secure Signup & Login**: All accounts are managed by Firebase Auth (Email/Password).
- **No Re-registration**: Once signed up, users can log in on any device at any time.
- **Smart Error Messages**: User-friendly prompts guide users if they enter wrong credentials or try to sign up with an existing email.
- **Role-Based Routing**: Firebase automatically routes users to their correct dashboard (Customer, Vendor, or Admin) on login.

### 👤 Customer Experience
- **Digital E-Wallet**: Top up your balance and spend it on local goods.
- **Buy & Track Orders**: Every purchase is recorded in the cloud with a unique pickup code.
- **Order Availability**: See real-time indicator (`LIVE` / `OFF`) for every shop. The "Buy Now" button is automatically disabled if the shop is closed.
- **Order Cancellation & Refund**: Cancel a pending order and get an instant wallet refund.
- **Flash Sale Deals**: See live discounted items highlighted in a banners section.
- **Direct Vendor Contact**: Vendor phone numbers are shown on every product card.

### 🏭 Vendor Dashboard
- **Add & Manage Products**: List items with prices, images/icons, and availability status.
- **NEW: Real-time Shop Status**: Vendors can now toggle their entire shop "LIVE" or "OFF" with a single click. When set to "OFF", customers are notified and cannot place new orders.
- **NEW: Camera Capture**: Vendors can now take a live product photo directly from the dashboard using their device camera during the "Add Product" flow.
- **Flash Sales**: Toggle a flash sale to offer 20% off and attract more buyers.
- **Verify Pickups**: Customers receive a 4-digit pickup code to show the vendor when collecting their order.
- **Live Income Tracking**: Vendor's total earned income updates in real-time after every verified sale.

### 🛡️ Admin Command Center
- **Real-time Platform Revenue**: Instant tracking of every verified sale across the marketplace.
- **Unified Orders History**: Monitor all transactions (PENDING / COMPLETED / CANCELLED) from one central hub.
- **User Management**: Direct overview of Customer spending and Vendor income for complete platform oversight.
- **Dedicated Support Ticketing**: A scalable help desk where admins can view and resolve customer/vendor issues instantly.
- **Secure Authentication**: Protected access via `admin@admin.com` credentials.

### 🎨 Aesthetic: Warm Organic Theme
- **Premium Design**: Transitioned from a dark theme to a warm, earthy, and elegant aesthetic (Beige/Cream/Cocoa).
- **Modern UI**: Featuring wavy section dividers, cushioned product cards (`32px` radius), and high-quality artisanal imagery.

---

## 🛠️ Tech Stack

| Layer       | Technology                                  |
|-------------|---------------------------------------------|
| Frontend    | Vanilla HTML5, CSS3, JavaScript (ES Modules) |
| Auth        | Firebase Authentication (Email/Password)    |
| Database    | Cloud Firestore (Real-time NoSQL)           |
| Hosting     | Node.js + Express (local / Render)          |

---

## 🔥 Firebase Database Structure

```
Firestore
├── users/                      # All customer & vendor profiles
│   └── {email}
│       ├── name, role, email
│       ├── walletBalance, totalSpent (Customers)
│       └── shopName, phoneNumber, totalGenerated (Vendors)
│
├── storeItems/                 # Marketplace product listings
│   └── {item_id}
│       ├── title, price, originalPrice
│       ├── vendorEmail, vendorName, vendorPhone
│       ├── status (IN_STOCK / SOLD_OUT)
│       ├── flashSaleActive
│       └── reservedTokens[]
│
├── orders/                     # Permanent transaction records
│   └── {order_id}
│       ├── title, price, vendor
│       ├── customerEmail, customerName
│       ├── pickup_code
│       ├── status (PENDING / COMPLETED / CANCELLED)
│       └── timestamp
│
├── supportTickets/             # Help desk collection
│   └── {ticket_id}
│       ├── user, email, issue
│       ├── status (OPEN)
│       └── timestamp
│
└── config/
    └── platformMetrics
        └── totalIncome
```

---

## 🏁 Getting Started

### 1. Set Up Firebase
1. Go to [console.firebase.google.com](https://console.firebase.google.com/)
2. Select project `digital-street-82508`
3. Go to **Authentication → Sign-in method** and enable **Email/Password**
4. Go to **Firestore Database** and ensure it is in production/test mode

### 2. Run the App Locally
Open a terminal in the project root and start the server:
```bash
npm start
```
Visit `http://localhost:3000` in your browser.

### 3. Create Accounts
- Go to the **Login** page and click **Sign Up** to create a Customer or Vendor account.
- For Admin access, click **Enterprise Portal** and use the password below.

---

## 🔑 Credentials

| Role    | Login Details                          |
|---------|----------------------------------------|
| Admin   | Email: `admin@admin.com` <br> Password: `Anivesh@123` |
| Customer | Sign up with any email / password     |
| Vendor  | Sign up with Shop Name & Phone Number |

---

## 📦 Order Flow

```
Customer Buys Item
       ↓
Wallet Deducted → Order Created (PENDING) → Pickup Code Shown
       ↓
Customer visits Vendor → Shows Code
       ↓
Vendor enters code → Order → COMPLETED
Vendor income updated, Platform revenue updated
       ↓
[OR] Customer cancels → Order → CANCELLED → Wallet Refunded
```

---


