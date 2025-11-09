import * as admin from 'firebase-admin';
import dotenv from 'dotenv';

dotenv.config();

async function main() {
  let targetOwnerId = process.env.BACKFILL_OWNER_UID;
  const targetOwnerEmail = process.env.BACKFILL_OWNER_EMAIL;

  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.applicationDefault()
    });
  }

  const db = admin.firestore();

  if (!targetOwnerId && targetOwnerEmail) {
    console.log(`Resolving UID by email: ${targetOwnerEmail}`);
    const userRecord = await admin.auth().getUserByEmail(targetOwnerEmail);
    targetOwnerId = userRecord.uid;
  }

  if (!targetOwnerId) {
    console.error('Missing BACKFILL_OWNER_UID or BACKFILL_OWNER_EMAIL env var');
    process.exit(1);
  }

  console.log(`Backfilling ownerId for items → ${targetOwnerId}`);

  const snapshot = await db.collection('items').get();
  let updated = 0;
  for (const doc of snapshot.docs) {
    const data = doc.data() as any;
    if (!data.ownerId) {
      await doc.ref.update({ ownerId: targetOwnerId });
      updated++;
    }
  }

  console.log(`Done. Updated ${updated} documents out of ${snapshot.size}.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});


