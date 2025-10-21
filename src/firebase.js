// src/firebase.js
// Firebase configuration and initialization for reuse across the app
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAKmahLQk1q7UPceG9qQtAo-7PnHHxAPUc",
  authDomain: "arm-app-5ce41.firebaseapp.com",
  projectId: "arm-app-5ce41",
  storageBucket: "arm-app-5ce41.firebasestorage.app",
  messagingSenderId: "520091617341",
  appId: "1:520091617341:web:60337bd45ea73466d6c254"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export { app, db };
