import { initializeApp } from 'firebase/app';
import { getAuth, browserLocalPersistence, indexedDBLocalPersistence, initializeAuth, browserPopupRedirectResolver } from 'firebase/auth';
import { initializeFirestore, persistentLocalCache, memoryLocalCache } from 'firebase/firestore';
import { firebaseConfig, FIRESTORE_DATABASE_ID } from '../firebase-config';

// appId is optional for Auth + Firestore; drop empty values so the SDK does not complain.
const cfg: Record<string, string> = {};
Object.entries(firebaseConfig).forEach(([k, v]) => { if (v) cfg[k] = v; });

export const app = initializeApp(cfg);

let authInstance;
try {
  authInstance = initializeAuth(app, {
    persistence: [indexedDBLocalPersistence, browserLocalPersistence],
    popupRedirectResolver: browserPopupRedirectResolver,
  });
} catch {
  authInstance = getAuth(app);
}
export const auth = authInstance;

let fs;
try {
  fs = initializeFirestore(app, { localCache: persistentLocalCache() }, FIRESTORE_DATABASE_ID);
} catch {
  fs = initializeFirestore(app, { localCache: memoryLocalCache() }, FIRESTORE_DATABASE_ID);
}
/** Same named database as the Android app: FirebaseFirestore.getInstance(firestore_database_id). */
export const db = fs;
