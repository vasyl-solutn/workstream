import * as admin from 'firebase-admin';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Initialize Firebase Admin with application default credentials
try {
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.applicationDefault()
    });
    console.log('Firebase Admin SDK initialized successfully');
  }
} catch (error) {
  console.error('Error initializing Firebase Admin SDK:', error);
  throw error;
}

// Export Firestore instance
export const db = admin.firestore();

// Export other Firebase services as needed
export const auth = admin.auth();
export const storage = admin.storage();

// Test Firestore connection
db.collection('test').doc('connection-test').set({
  timestamp: admin.firestore.FieldValue.serverTimestamp(),
  message: 'Connection test'
})
.then(() => {
  console.log('Successfully connected to Firestore');
})
.catch((error) => {
  if (error.code === 5) {
    console.error('ERROR: Firestore database not found. Please create a Firestore database in the Firebase console:');
    console.error('1. Go to https://console.firebase.google.com/');
    console.error('2. Select your project');
    console.error('3. Click on "Firestore Database" in the left sidebar');
    console.error('4. Click "Create database"');
    console.error('5. Choose mode and location, then click "Enable"');
  } else {
    console.error('Error connecting to Firestore:', error);
  }
});

console.log('Firebase initialized successfully with application default credentials');
