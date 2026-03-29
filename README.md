# 🏪 Digital Street Marketplace 

Digital Street is a modern neighborhood marketplace connecting local vendors directly to their customers. This version is powered by a **Persistent Node.js Backend**, saving all your data securely to your computer without needing any cloud configuration.

## 🚀 Key Features

### 👤 User Account System
*   **Persistent Login**: All user registrations are saved to `database.json`.
*   **Role-Based Profiles**: Vendors have Shop names and Phone numbers; Customers have digital wallets.
*   **Mandatory Authentication**: You must sign up and log in before accessing the marketplace.

### 🍱 Customer Experience
*   **Digital E-Wallet**: Top up mock currency and buy local goods.
*   **Direct Contact**: Vendor phone numbers are visible on every product for pickup coordination.
*   **Real-time Sync**: The marketplace automatically refreshes every few seconds to show new items.

### 🏭 Vendor Dashboard
*   **Store Management**: Add/Edit products easily.
*   **Persistent Inventory**: Your products stay listed even if you restart the server.
*   **Batch Timers & Flash Sales**: Ready-made tools to drive neighborhood sales.

### 🛡️ Admin Vault
*   **Platform Analytics**: Track total income and order history.
*   **User Directory**: Detailed tables for Customer spending and Vendor revenue.
*   **Security**: Guarded by master password: `Anivesh@123`.

## 🛠️ Tech Stack

*   **Frontend**: Vanilla HTML5, CSS3, JavaScript.
*   **Backend**: Node.js + Express.
*   **Database**: Local JSON persistence (`fs`-based).

## 🏁 Getting Started

### 1. Run the Backend
Open a terminal in the `backend/` folder and start the server:
```bash
cd backend
node server.js
```
The server will create a `database.json` file to save your data.

### 2. Run the Frontend
Open another terminal in the `frontend/` folder:
```bash
cd frontend
npx serve -l 8080
```
Visit `http://localhost:8080` in your browser.

---

### 🔑 Admin Credentials
*   **Admin Access**: `Anivesh@123`
