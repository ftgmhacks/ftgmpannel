--- START OF FILE text/javascript ---
import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js";
import { getFirestore, collection, getDocs, query, where, orderBy, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js";

// 1. FIREBASE CONFIGURATION
const firebaseConfig = {
  apiKey: "AIzaSyD6VSIGbUJqIMQb53k1mXAcGjNu9PFC1w0",
  authDomain: "new-smm02.firebaseapp.com",
  databaseURL: "https://new-smm02-default-rtdb.firebaseio.com",
  projectId: "new-smm02",
  storageBucket: "new-smm02.firebasestorage.app",
  messagingSenderId: "2203224901",
  appId: "1:2203224901:web:7b328bb0ea4c381afe0c2c"
};

// 2. SAFE INITIALIZATION (Prevents duplicate app errors)
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// 3. GLOBAL STORE OBJECT
export const store = {
  user: null,
  userData: null,
  isAuthenticated: false
};

// ============================================================================
// 🚨 THE FIX: ALL DATABASE QUERIES MUST BE INSIDE ON_AUTH_STATE_CHANGED
// ============================================================================
onAuthStateChanged(auth, async (user) => {
  if (user) {
    // User is signed in. It's now safe to query Firestore!
    store.user = user;
    store.isAuthenticated = true;

    try {
      // Example: Fetch user data securely
      const userRef = doc(db, 'users', user.uid);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        store.userData = userSnap.data();
      }

      // -------------------------------------------------------------
      // ROUTER: EXECUTE SPECIFIC PAGE LOGIC ONLY IF ON THAT PAGE
      // -------------------------------------------------------------
      const pathname = window.location.pathname;

      // Logic for History Page
      if (pathname.includes('history.html')) {
        initHistoryLogic(user.uid);
      }
      
      // Logic for Funds Page
      if (pathname.includes('funds.html')) {
        initFundsLogic(user.uid);
      }

    } catch (error) {
      console.warn("Store.js safe warning:", error.message);
    }
  } else {
    // User is signed out. Clear store.
    store.user = null;
    store.userData = null;
    store.isAuthenticated = false;
  }
});

// ============================================================================
// MODULAR FUNCTIONS (ONLY CALLED WHEN AUTHENTICATED)
// ============================================================================

async function initHistoryLogic(uid) {
  const tableBody = document.getElementById('history-table-body');
  if (!tableBody) return;

  try {
    const q = query(
      collection(db, 'orders'),
      where('userId', '==', uid)
      // Note: Removed orderBy to prevent Composite Index errors. We will sort in JavaScript.
    );
    
    const snap = await getDocs(q);
    let orders = [];
    snap.forEach(d => orders.push({ id: d.id, ...d.data() }));

    // Sorting by date (Newest first) via JavaScript (No Firestore Index required)
    orders.sort((a, b) => {
      const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
      const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
      return timeB - timeA;
    });

    // Populate Table (Basic Example)
    if (orders.length === 0) {
      tableBody.innerHTML = '<tr><td colspan="5" class="text-center">No orders found.</td></tr>';
    } else {
      // You can expand this based on your exact history table structure
      console.log("Orders loaded safely:", orders.length);
    }
  } catch (error) {
    console.error("History loading error:", error);
  }
}

async function initFundsLogic(uid) {
  // Add funds logic here (only runs if the user is on funds.html and fully verified)
  const walletDisplay = document.getElementById('funds-wallet-balance');
  if (walletDisplay && store.userData) {
    walletDisplay.textContent = 'Rs. ' + (parseFloat(store.userData.wallet || 0)).toFixed(2);
  }
}

export { app, auth, db };
--- END OF FILE text/javascript ---
