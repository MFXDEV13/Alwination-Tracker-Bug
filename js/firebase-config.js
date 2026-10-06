export const firebaseConfig = {
  apiKey: 'AIzaSyD70ahKABccU7CYizswoV8mCeUNDc43vc0',
  authDomain: 'alwination-tracker.firebaseapp.com',
  projectId: 'alwination-tracker',
  storageBucket: 'alwination-tracker.firebasestorage.app',
  messagingSenderId: '598474139533',
  appId: '1:598474139533:web:7846e55721055494bfffc4',
  measurementId: 'G-3ZYJJ2M8K1',
};

export const ADMIN_EMAILS = ['azwarptk5@gmail.com'];
export const TRUSTED_EMAILS = ['azwarptk5@gmail.com'];

export const isFirebaseConfigured = Object.values(firebaseConfig)
  .every(value => value && !value.includes('YOUR_'));