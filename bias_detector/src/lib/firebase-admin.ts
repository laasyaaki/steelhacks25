import * as admin from 'firebase-admin';

let firestoreInstance: admin.firestore.Firestore;

if (!admin.apps.length) {
  try {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON as string);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    firestoreInstance = admin.firestore(); // Initialize here
  } catch (error) {
    if (error instanceof Error) {
        console.log('Firebase admin initialization error', error.stack);
    }
    // Handle the error, perhaps throw it or return null
    throw new Error("Firebase Admin SDK initialization failed.");
  }
} else {
  firestoreInstance = admin.firestore(); // If already initialized, get the instance
}

export { admin, firestoreInstance as firestore };
