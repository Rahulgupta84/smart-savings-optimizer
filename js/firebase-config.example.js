// Copy this file to js/firebase-config.js and fill in your Firebase credentials.
// Get them from: Firebase Console → Project Settings → Your Apps → Web app config.
// IMPORTANT: js/firebase-config.js is in .gitignore and must NEVER be committed.
//
// Setup steps:
//   1. Go to https://console.firebase.google.com and create a project.
//   2. Add a Web app (</> icon) — no Firebase Hosting needed.
//   3. Copy the config object shown and paste it below.
//   4. Enable Authentication: Console → Auth → Sign-in method → Google + Email/Password.
//   5. Enable Firestore: Console → Firestore → Create database (start in production mode,
//      then set rules to allow reads/writes only for authenticated users).
//
// Recommended Firestore security rules:
//   rules_version = '2';
//   service cloud.firestore {
//     match /databases/{database}/documents {
//       match /users/{userId} {
//         allow read, write: if request.auth != null && request.auth.uid == userId;
//       }
//     }
//   }

const FIREBASE_CONFIG = {
  apiKey:            "YOUR_API_KEY",
  authDomain:        "your-project.firebaseapp.com",
  projectId:         "your-project-id",
  storageBucket:     "your-project.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId:             "YOUR_APP_ID",
};
