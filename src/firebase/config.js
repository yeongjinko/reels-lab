import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyAxSPxbnjqf6Zr_ZEqDSxwjlsb9aPt8SwA",
  authDomain: "reelscopy-3e18c.firebaseapp.com",
  projectId: "reelscopy-3e18c",
  storageBucket: "reelscopy-3e18c.firebasestorage.app",
  messagingSenderId: "547849763914",
  appId: "1:547849763914:web:53fd1f3c5dbbc6595b3ab3",
  measurementId: "G-GKJ7WCKC7N"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();
