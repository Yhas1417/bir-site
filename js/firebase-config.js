import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
 
const firebaseConfig = {
  apiKey: "AIzaSyArIYOp-msUGe_T4bLiVkoDhvXYhLuWVeo",
  authDomain: "test-sitem.firebaseapp.com",
  databaseURL: "https://test-sitem-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "test-sitem",
  storageBucket: "test-sitem.firebasestorage.app",
  messagingSenderId: "97147105273",
  appId: "1:97147105273:web:6e70cf559735f68fb8d728"
};
 
const app  = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db   = getFirestore(app);
 
export { auth, db };
