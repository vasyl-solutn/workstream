import { Item as SharedItem } from '@workstream/shared';
import * as admin from 'firebase-admin';

// Only extend the Item interface to specify the Firebase timestamp type
export interface Item extends Omit<SharedItem, 'createdAt'> {
  createdAt: admin.firestore.Timestamp | null;
}
