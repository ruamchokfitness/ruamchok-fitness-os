import { initializeApp, getApps, getApp, App } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { firebaseConfig } from "./config";

let app: App;

if (!getApps().length) {
  app = initializeApp({
    credential: undefined, // Let ADC find the credentials
    projectId: firebaseConfig.projectId,
  });
} else {
  app = getApp();
}

export const db = getFirestore(app);
