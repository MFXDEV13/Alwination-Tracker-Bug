# Firebase Authentication Setup

The login scaffold uses Google Sign-In and currently allows only `azwarptk5@gmail.com`. This account is also the only admin and can delete reports.

1. The app is configured for the Firebase project `alwination-tracker`; confirm that this is the intended project in Firebase Console.
2. The Web app values are already populated in `js/firebase-config.js`. They are client configuration, not service-account secrets.
3. In Firebase Console, open **Authentication** and select **Get started** if prompted. Then enable Google under **Sign-in method** and add the app's host (for local testing, `localhost`) under **Settings > Authorized domains**.
4. Create a Firestore database in the same region you intend to use, then deploy its rules: `firebase deploy --only firestore:rules`.
5. To authorize another non-admin email, add it to `TRUSTED_EMAILS` in `js/firebase-config.js` and `isTrusted()` in `firestore.rules`. To grant admin deletion rights, also add it to `ADMIN_EMAILS` and `isAdmin()` in those files. Redeploy the rules after changing them.

Do not place a service-account key in this static project. The browser-side email check only controls the interface; Firestore Rules are the security boundary for database access.

Reports and comments are now read from and written to Firestore. The first dashboard load is empty until reports are submitted; the former example reports were not imported because they were demo data. Login is a client-side display gate, while Firestore Rules enforce data access. Do not put private report data back into static HTML or JavaScript.

The site itself is still deployed separately through Firebase Hosting. To publish it after reviewing the public files, run `firebase deploy --only hosting` from the project root.