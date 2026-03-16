import * as admin from 'firebase-admin';
import path from 'path';

let db: admin.firestore.Firestore;

try {
  let serviceAccount;
  
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    console.log('FIREBASE_SERVICE_ACCOUNT env var found, length:', process.env.FIREBASE_SERVICE_ACCOUNT.length);
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    console.log('Firebase initializing from environment variable, project:', serviceAccount.project_id);
  } else {
    const serviceAccountPath = path.resolve(__dirname, '../../serviceAccountKey.json');
    serviceAccount = require(serviceAccountPath);
    console.log('Firebase initializing from local file');
  }
  
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: serviceAccount.project_id
  });
  
  console.log('Firebase Admin SDK initialized with project ID:', serviceAccount.project_id);
} catch (error) {
  console.error('Firebase initialization error:', error);
  console.error('FIREBASE_SERVICE_ACCOUNT present:', !!process.env.FIREBASE_SERVICE_ACCOUNT);
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    console.error('First 50 chars:', process.env.FIREBASE_SERVICE_ACCOUNT.substring(0, 50));
  }
}

db = admin.firestore();

export { db };
export default admin;
