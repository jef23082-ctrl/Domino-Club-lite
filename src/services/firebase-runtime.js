import { FIREBASE_CONFIG } from '../config/firebase.js?v=20260906T181957527';

export function createFirebaseRuntime(firebaseCompat = globalThis.firebase) {
  if (!firebaseCompat) throw new Error('Le SDK Firebase compat n’est pas chargé.');
  const app = firebaseCompat.apps?.length
    ? firebaseCompat.app()
    : firebaseCompat.initializeApp(FIREBASE_CONFIG);
  return {
    app,
    database: firebaseCompat.database(),
    serverTimestamp: () => firebaseCompat.database.ServerValue.TIMESTAMP
  };
}
