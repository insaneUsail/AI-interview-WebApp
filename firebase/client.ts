// Import the functions you need from the SDKs you need
import { getApp, getApps, initializeApp } from "firebase/app";
// import { getAnalytics } from "firebase/analytics";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyDLctup331c3D32TD4qDv3-lm4ahCIiVM8",
  authDomain: "innerviewai-67559.firebaseapp.com",
  projectId: "innerviewai-67559",
  storageBucket: "innerviewai-67559.firebasestorage.app",
  messagingSenderId: "283123140461",
  appId: "1:283123140461:web:66f2489f08fffeb4aafc64",
  measurementId: "G-X60G22Z6B4"
};

// Initialize Firebase
const app = !getApps.length ? initializeApp(firebaseConfig) : getApp();

export const auth = getAuth(app);
export const db = getFirestore(app);
// export const analytics = getAnalytics(app);