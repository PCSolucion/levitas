import { auth, provider, db } from "../config/firebase-config.js";
import { 
    signInWithPopup, 
    onAuthStateChanged
} from "firebase/auth";
import { doc, setDoc, getDoc, serverTimestamp } from "firebase/firestore";

const btnGoogle = document.getElementById("btn-google");
const authError = document.getElementById("auth-error");

// Initial sync if user is already logged in
onAuthStateChanged(auth, (user) => {
    if (user) {
        window.location.href = "dashboard.html";
    }
});

const showError = (msg) => {
    console.error("Auth Error:", msg);
    authError.innerText = msg;
    authError.classList.remove("hidden");
};

// Check for file protocol (Firebase Auth DOES NOT work with file://)
if (window.location.protocol === "file:") {
    showError("⚠️ ¡Atención! Firebase Auth no funciona si abres el archivo .html directamente (file://). Debes usar un servidor local (como 'Live Server' en VS Code o npx serve).");
}

const createUserInFirestore = async (user) => {
    const userRef = doc(db, "users", user.uid);
    const docSnap = await getDoc(userRef);
    
    if (!docSnap.exists()) {
        await setDoc(userRef, {
            uid: user.uid,
            email: user.email,
            displayName: user.displayName || "Usuario",
            photoURL: user.photoURL || "",
            plan: "Cuenta Gratuita",
            createdAt: serverTimestamp()
        });
    }
};

const handleGoogle = async () => {
    authError.classList.add("hidden");
    try {
        const result = await signInWithPopup(auth, provider);
        await createUserInFirestore(result.user);
        window.location.href = "dashboard.html";
    } catch (error) {
        console.error("Google Auth Error:", error);
        if (error.code === "auth/operation-not-allowed") {
            showError("Google Auth no está habilitado en tu consola de Firebase (Autenticación > Sign-in methods).");
        } else if (error.code === "auth/unauthorized-domain") {
            showError("Este dominio no está autorizado en Firebase (Añade 'localhost' en Autenticación > Settings > Dominios Autorizados).");
        } else {
            showError("Error al iniciar sesión con Google: " + error.message);
        }
    }
};

if(btnGoogle) btnGoogle.addEventListener("click", handleGoogle);
