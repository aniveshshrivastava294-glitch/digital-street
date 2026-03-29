# 🏪 Digital Street Marketplace (Cloud Version)

Digital Street is a modern, real-time neighborhood marketplace connecting local vendors directly to their customers. This version is powered by **Firebase**, providing a global, real-time sync across all devices without needing a local server.

## 🚀 Features

### 🔐 Firebase User Accounts
*   **Mandatory Authentication**: Real Sign-up/Login powered by **Firebase Auth**.
*   **Persistent Profiles**: Shop names, names, and contact details are stored in **Cloud Firestore**.
*   **Secure Roles**: Automatic redirection based on Customer or Vendor roles.

### 🍱 Customer Experience
*   **Digital E-Wallet**: Top up mock currency that persists in the cloud.
*   **Live Marketplace**: Real-time Firestore streaming means products update **instantly** on your screen.
*   **Direct Contact**: Every product card displays the vendor's phone number for pickup coordination.
*   **Reservation Codes**: Secure pickup codes generated and stored in the Cloud for every purchase.

### 🏭 Vendor Dashboard
*   **Cloud Inventory**: List items that are visible to all customers globally.
*   **Real-time Timers**: When you start a baking timer, every customer sees the countdown in real-time.
*   **Dynamic Flash Sales**: Instant 20% price drops across the platform.

### 🛡️ Admin Vault
*   **Cloud Analytics**: Monitor total platform revenue and global order history.
*   **Live User Database**: Real-time tables showing everyone's spend and income.
*   **Access Control**: Securely guarded by master password: `Anivesh@123`.

## 🛠️ Tech Stack

*   **Frontend**: Vanilla HTML5, CSS3 (Glassmorphism), Vanilla JavaScript.
*   **Backend (Serverless)**: Firebase Authentication & Cloud Firestore.
*   **Iconography**: Lucide-React.
*   **Data Sync**: Firestore `onSnapshot` real-time listeners.

## 🏁 Getting Started

### 1. Prerequisites
This version runs entirely in the browser. You only need a static web server.

### 2. Configuration
The project is already pre-configured with the specific **Firebase Configuration** for Digital Street. 

### 3. Run the App
Navigate to the `frontend/` folder and serve the application:
```bash
cd frontend
npx serve -l 8080
```
Open `http://localhost:8080` in your browser.

## 📱 Mobile Access
Since this is cloud-powered, you can access the app from any device with an internet connection once it's deployed. For local testing:
1.  Connect your phone to the same Wi-Fi.
2.  Open your computer's local IP (e.g., `192.168.1.XX:8080`).

---

### 🔑 Admin Credentials
*   **Admin Access**: `Anivesh@123`
