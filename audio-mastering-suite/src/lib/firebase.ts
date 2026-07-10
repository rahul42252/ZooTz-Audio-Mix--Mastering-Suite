import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithCredential,
  User
} from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  addDoc, 
  getDocs, 
  query, 
  where, 
  orderBy, 
  Timestamp,
  deleteDoc,
  doc
} from 'firebase/firestore';

// Configuration from firebase-applet-config.json
const firebaseConfig = {
  projectId: "hybrid-bonfire-2fs6l",
  appId: "1:99776360026:web:b1a729b67c17403e99b263",
  apiKey: "AIzaSyDg03IdHDNGJX2E7Y1iNCcGbZu04Fu_7Ts",
  authDomain: "hybrid-bonfire-2fs6l.firebaseapp.com",
  databaseId: "ai-studio-audiomasteringsu-2d874d22-09bd-4937-a035-9bbd5c82f00c",
  storageBucket: "hybrid-bonfire-2fs6l.firebasestorage.app",
  messagingSenderId: "99776360026"
};

// Initialize Firebase
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);
const db = getFirestore(app);

export { 
  app, 
  auth, 
  db,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithCredential,
  collection,
  addDoc,
  getDocs,
  query,
  where,
  orderBy,
  Timestamp,
  deleteDoc,
  doc,
  type User
};
