import { onAuthStateChanged } from "firebase/auth";
import { auth } from "./firebase-config.js";
import { TimerManager } from "./timer-manager.js";

document.addEventListener("DOMContentLoaded", () => {
    onAuthStateChanged(auth, (user) => {
        if (user) {
            new TimerManager(user.uid).init();
        } else {
            window.location.href = "login.html";
        }
    });
});
