# MongoDB and Vercel Setup

MongoDB is accessed only by the Vercel API under `api/`. The browser continues to use Firebase Google Sign-In; each API request includes a Firebase ID token, which the server verifies before accessing MongoDB.

## Rotate credentials first

The MongoDB URI was shared in chat. Rotate that database user's password in MongoDB Atlas before using the integration. Do not put the URI, Firebase service-account JSON, or any private key in frontend files or commit them to Git.

## Local development

1. Install dependencies with `npm install`.
2. Copy `.env.example` to `.env.local`.
3. Set `MONGODB_URI` to the newly rotated connection URI and set `MONGODB_DB` to the database name you want to use.
4. In Firebase Console, create a service account for the `alwination-tracker` project. Put its JSON in the `FIREBASE_SERVICE_ACCOUNT` environment variable as one JSON value. Never commit that value.
5. Set `TRUSTED_EMAILS` and `ADMIN_EMAILS` as comma-separated addresses. The admin list controls report deletion.
6. Start the app with `npm run dev` and open the local URL printed by Vercel.

## Vercel deployment

Import this repository into Vercel and set `MONGODB_URI`, `MONGODB_DB`, `FIREBASE_SERVICE_ACCOUNT`, `TRUSTED_EMAILS`, and `ADMIN_EMAILS` in Project Settings > Environment Variables. Redeploy after changing environment variables. Keep MongoDB Atlas Network Access restricted to the chosen Vercel connection method; do not expose the database to all IP addresses as a shortcut.

Firebase Authentication must keep Google Sign-In enabled and include the deployed Vercel domain in Authorized Domains. `firebase.json` and `firestore.rules` are no longer used by this MongoDB API deployment.

The old hard-coded demo reports were not imported. Reports are created in the MongoDB `reports` collection; comments are stored separately in `comments` so deleting a report can clean them up without embedding an ever-growing list in one document.