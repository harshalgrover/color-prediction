import * as admin from 'firebase-admin';
import path from 'path';

try {
  let serviceAccount;
  
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    console.log('Firebase initializing from environment variable');
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
}

export const db = admin.firestore();
export default admin;
