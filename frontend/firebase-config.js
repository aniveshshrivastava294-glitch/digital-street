// Firebase Configuration and Initialization
const firebaseConfig = {
  apiKey: "AIzaSyCiKr83Yf_RJPwzVKiBVXPzK-7yprSDvxQ",
  authDomain: "digital-street-82508.firebaseapp.com",
  projectId: "digital-street-82508",
  storageBucket: "digital-street-82508.firebasestorage.app",
  messagingSenderId: "18096900581",
  appId: "1:18096900581:web:9a2f5ab81edc959bf1070c",
  measurementId: "G-JFTKSMPCQL"
};

// Initialize Firebase (Compat mode for easier migration of global functions)
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

console.log("🚀 Digital Street: Firebase Initialized Successfully");
