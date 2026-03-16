import * as admin from 'firebase-admin';
import path from 'path';

let db: admin.firestore.Firestore;

try {
  let serviceAccount: any;
  
  if (process.env.FIREBASE_SERVICE_ACCOUNT_BASE64) {
    const decoded = Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_BASE64, 'base64').toString('utf-8');
    serviceAccount = JSON.parse(decoded);
    console.log('Firebase initializing from base64 env var, project:', serviceAccount.project_id);
  } else if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    if (serviceAccount.private_key) {
      serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
    }
    console.log('Firebase initializing from JSON env var, project:', serviceAccount.project_id);
  } else {
    const serviceAccountPath = path.resolve(__dirname, '../../serviceAccountKey.json');
    serviceAccount = require(serviceAccountPath);
    console.log('Firebase initializing from local file');
  }
  
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: serviceAccount.project_id
  });
  
  db = admin.firestore();
  console.log('Firebase Admin SDK initialized successfully');
} catch (error) {
  console.error('Firebase initialization error:', error);
  process.exit(1);
}

export { db };
export default admin;
