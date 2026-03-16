import * as admin from 'firebase-admin';
import path from 'path';

let db: admin.firestore.Firestore;

try {
  let serviceAccount: any;
  
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    console.log('FIREBASE_SERVICE_ACCOUNT env var found, length:', process.env.FIREBASE_SERVICE_ACCOUNT.length);
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    // Fix escaped newlines in private_key (common env var issue)
    if (serviceAccount.private_key) {
      serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
    }
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
  
  db = admin.firestore();
  console.log('Firebase Admin SDK initialized with project ID:', serviceAccount.project_id);
} catch (error) {
  console.error('Firebase initialization error:', error);
  process.exit(1);
}

export { db };
export default admin;
