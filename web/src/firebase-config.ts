/**
 * Firebase configuration for the eSkyTell web app.
 *
 * Values below come from app/google-services.json (Android) of the same Firebase project
 * `gen-lang-client-0105568417`, so the web app reads/writes the SAME Firestore data and Auth users.
 *
 * TODO (owner): register a Web app in Firebase Console → Project settings → General → "Add app" → Web,
 * then paste the generated `appId` and `messagingSenderId` below. Auth and Firestore work without
 * `appId`; Analytics / App Check / FCM need it.
 */
export const firebaseConfig = {
  apiKey: 'AIzaSyBlHg_h_Anv4SI2bpOcC563YHl-CUh_vxA',
  authDomain: 'gen-lang-client-0105568417.firebaseapp.com',
  projectId: 'gen-lang-client-0105568417',
  storageBucket: 'gen-lang-client-0105568417.firebasestorage.app',
  // TODO: paste from Firebase Console (Web app). project_number from google-services.json is 380650092073.
  messagingSenderId: '380650092073',
  // TODO: paste the Web appId, e.g. '1:380650092073:web:xxxxxxxxxxxxxxxxxxxxxx'
  appId: '',
};

/** Named (non-default) Firestore database used by the Android app (res/values/firebase_applet_config.xml). */
export const FIRESTORE_DATABASE_ID = 'ai-studio-android-eskytell-cf7f4dde-bd08-4864-9f68-5fd5fc18d8b7';

/** Same constant as CloudAdminRepository.BOOTSTRAPPED_ADMIN_EMAIL and firestore.rules isBootstrappedAdmin(). */
export const BOOTSTRAPPED_ADMIN_EMAIL = 'sepehrtixzor1@gmail.com';
