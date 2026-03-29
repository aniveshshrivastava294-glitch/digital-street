// Firebase SDK (Modular CDN Versions)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-analytics.js";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCiKr83Yf_RJPwzVKiBVXPzK-7yprSDvxQ",
  authDomain: "digital-street-82508.firebaseapp.com",
  projectId: "digital-street-82508",
  storageBucket: "digital-street-82508.firebasestorage.app",
  messagingSenderId: "18096900581",
  appId: "1:18096900581:web:9a2f5ab81edc959bf1070c",
  measurementId: "G-JFTKSMPCQL"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const analytics = getAnalytics(app);

export { app, auth, db, analytics };
