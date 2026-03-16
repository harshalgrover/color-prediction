import * as admin from 'firebase-admin';
import path from 'path';

try {
  const serviceAccountPath = path.resolve(__dirname, '../../serviceAccountKey.json');
  const serviceAccount = require(serviceAccountPath);
  
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: serviceAccount.project_id
  });
  
  console.log('Firebase Admin SDK initialized explicitly with project ID:', serviceAccount.project_id);
} catch (error) {
  console.error('Firebase initialization error:', error);
}

export const db = admin.firestore();
export default admin;
