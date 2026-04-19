import { initializeApp, cert, getApps, getApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { readFile } from "fs/promises";

let app;
let adminAuth;

try {
    const serviceAccount = JSON.parse(
        await readFile(new URL("../../firebase-service-account.json", import.meta.url))
    );

    if (getApps().length === 0) {
        app = initializeApp({
            credential: cert(serviceAccount)
        });
        console.log("✅ Firebase Admin initialized successfully");
    } else {
        app = getApp();
    }
    adminAuth = getAuth(app);
} catch (error) {
    console.error("❌ Firebase Admin Initialization Error:", error.message);
    // We don't initialize adminAuth here, so dependent controllers will handle the undefined/error
}

export { adminAuth };
export default app;
