import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyBRFm-MiIoj5YE78S9cGCwqMzwFI8rw-E8",
  authDomain: "fastingapp-193de.firebaseapp.com",
  projectId: "fastingapp-193de",
  storageBucket: "fastingapp-193de.firebasestorage.app",
  messagingSenderId: "440317081640",
  appId: "1:440317081640:web:36cfff85d20432795d1d1d"
};

// Inicializar Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

export { db, auth, provider };
