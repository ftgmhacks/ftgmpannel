PAK DIGITAL — UPDATED FILES (login fix + security)

FILES IN THIS ZIP
  index.js          Login/register — fixed the "stuck while logging in" hang
  pak.js            Dashboard/new order — fixed loader hang + atomic wallet debit
  store.js          NADRA / Fake Numbers / AI subs pages — same loader fix
  admin-key.js      NEW: admin secret-key gate (upload next to admin.html)
  admin.html        Admin panel — secret key required before ANY balance change
  firestore.rules   THE MAIN SECURITY FIX — publish this in Firebase

HOW TO INSTALL (3 steps)
1) Upload all files to your hosting, keeping the same names/folder.
2) Firebase Console -> Firestore Database -> Rules -> paste firestore.rules -> Publish.
3) Open Admin Panel -> Settings -> "Balance Secret Key" -> set a strong key.
   Write it down. It is stored only as a hash, it cannot be recovered or seen again.

WHY SOMEONE COULD ADD UNLIMITED FUNDS
Your old Firestore rules let any logged-in user write their own users/{uid}
document, including the "wallet" field, straight from the browser console.
The new rules make it impossible:
  - wallet on a new account MUST be 0
  - a user can only DECREASE his own wallet (spending), never increase it
  - role / status / email / uid can never be changed by the user
  - payments can only be created as "Pending"; only the admin can approve
  - walletTransactions credits are admin-only
  - everything else is denied by default
Plus, in the panel, every balance change (manual adjust, payment approve,
payment status change to/from Approved) now asks for the secret key,
which is stored only in Firebase as a salted SHA-256 hash.

RECOMMENDED NEXT STEP
Your SMM provider API key currently lives in settings/general, which every
logged-in user can read. Move it behind your server proxy when you can.
Also change your admin password and check users/orders for anything suspicious.
