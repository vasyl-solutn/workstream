import express, { Express, Request, Response, Router, RequestHandler } from 'express';
import cors from 'cors';
import { db } from './db';
import algoliasearch from 'algoliasearch';
import * as admin from 'firebase-admin';
import { CreateItemDto, Item } from '@workstream/shared';
import { ParamsDictionary } from 'express-serve-static-core';
import { DocumentData, Query } from 'firebase-admin/firestore';

// Ensure Item type is correctly including startedAt and parentId
type ItemUpdate = {
  title: string;
  estimation?: number;
  estimationFormat?: 'points' | 'time';
  priority?: number;
  startedAt?: string | null;
  parentId?: string | null;
};

const app: Express = express();
const port = process.env.PORT || 4000;
const router = express.Router() as Router;

app.use(cors());
app.use(express.json());

// Algolia setup (optional; enabled when env vars are provided)
const ALGOLIA_APP_ID = process.env.ALGOLIA_APP_ID;
const ALGOLIA_API_KEY = process.env.ALGOLIA_API_KEY; // Admin key for indexing
const ALGOLIA_INDEX_NAME = process.env.ALGOLIA_INDEX_NAME || 'items';

let algoliaIndex: any = null;
try {
  if (ALGOLIA_APP_ID && ALGOLIA_API_KEY) {
    const client = algoliasearch(ALGOLIA_APP_ID, ALGOLIA_API_KEY);
    algoliaIndex = client.initIndex(ALGOLIA_INDEX_NAME);
    console.log(`Algolia initialized for index ${ALGOLIA_INDEX_NAME}`);
    // Best-effort default settings
    (async () => {
      try {
        await algoliaIndex.setSettings({
          searchableAttributes: ['title'],
          removeWordsIfNoResults: 'allOptional',
          ignorePlurals: true
        });
        console.log('Algolia index settings applied');
      } catch (e) {
        console.warn('Algolia setSettings failed:', e);
      }
    })();
  } else {
    console.log('Algolia not configured (set ALGOLIA_APP_ID and ALGOLIA_API_KEY to enable)');
  }
} catch (e) {
  console.warn('Algolia init failed:', e);
}

async function syncItemToAlgolia(id: string, data: any) {
  if (!algoliaIndex) return;
  try {
    await algoliaIndex.saveObject({ objectID: id, ...data });
  } catch (e) {
    console.warn('Algolia saveObject failed:', e);
  }
}

async function deleteItemFromAlgolia(id: string) {
  if (!algoliaIndex) return;
  try {
    await algoliaIndex.deleteObject(id);
  } catch (e) {
    console.warn('Algolia deleteObject failed:', e);
  }
}

app.get('/', (req, res) => {
  res.json({ message: 'Welcome to Workstream API' });
});

// Example endpoint using Firestore
router.get('/api/test', async (req, res) => {
  try {
    // Add a test document
    const docRef = await db.collection('test').add({
      message: 'Hello from Firestore!',
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    });

    // Get the document back
    const doc = await docRef.get();

    res.json({
      id: docRef.id,
      data: doc.data()
    });
  } catch (error) {
    console.error('Error accessing Firestore:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

// Get all items
router.get('/items', async (req, res) => {
  try {
    const collectionStartTime = performance.now();
    const { parentId } = req.query;

    let items: Array<Item & { id: string }> = [];
    const parentIds = Array.isArray(parentId) ? parentId : parentId ? [parentId] : [];

    // Option 1: Fetch all and filter by parentIds
    const snapshot = await db.collection('items').orderBy('priority').get();
    const allItems = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Array<Item & { id: string }>;

    if (parentId === 'null') {
      // Filter for root level items (no parent)
      console.log('Filtering for root level items');
      items = allItems.filter(item => !item.parentId);
    } else if (parentIds.length > 0) {
        // Filter items that have any of the specified parentIds
        items = allItems.filter(item =>
          parentIds.includes(item.parentId as string)
        );
      } else {
      // Return all items if no filtering
      items = allItems;
    }

    console.info(`Items query: ${(performance.now() - collectionStartTime).toFixed(2)}ms, ${items.length} items`);
    res.json(items);
  } catch (error) {
    console.error('Error fetching items:', error);
    res.status(500).json({ error: 'Failed to fetch items' });
  }
});

// Get a single item
router.get('/items/:id', async (req: Request<{ id: string }>, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const itemRef = db.collection('items').doc(id);
    const item = await itemRef.get();

    if (!item.exists) {
      res.status(404).json({ error: 'Item not found' });
      return;
    }

    res.json({
      id: item.id,
      ...item.data()
    });
  } catch (error) {
    console.error('Error fetching item:', error);
    res.status(500).json({ error: 'Failed to fetch item' });
  }
});

// Helper function to update children count
async function updateChildrenCount(parentId: string | null) {
  const startTime = performance.now();
  if (!parentId) return;


  const childrenSnapshot = await db.collection('items')
    .where('parentId', '==', parentId)
    .get();
  console.info(`Database get children count took ${(performance.now() - startTime).toFixed(2)}ms`);

  const childrenCount = childrenSnapshot.size;

  console.info(`Database get children count size took ${(performance.now() - startTime).toFixed(2)}ms`);

  console.log({ parentId, childrenCount });

  const parentTime = performance.now();
  await db.collection('items').doc(parentId).update({
    childrenCount
  });
  console.info(`Database update children count took ${(performance.now() - parentTime).toFixed(2)}ms`);
}

// Add a new item
router.post('/items', async (req, res) => {
  const startTime = performance.now();
  try {
    const { title, estimation, estimationFormat, priority, previousId, nextId, startedAt, parentId } = req.body;

    if (!title) {
      res.status(400).json({ error: 'Title is required' });
      return;
    }

    const itemData = {
      title,
      estimation: estimation || 0,
      estimationFormat: estimationFormat || 'points',
      priority: priority || 0,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      childrenCount: 0, // Initialize children count
      ...(startedAt !== undefined && { startedAt }),
      ...(parentId !== undefined && { parentId })
    };

    let newItem;
    if (previousId && nextId) {
      // Insert between two items
      const [previousItem, nextItem] = await Promise.all([
        db.collection('items').doc(previousId).get(),
        db.collection('items').doc(nextId).get()
      ]);

      if (!previousItem.exists || !nextItem.exists) {
        res.status(404).json({ error: 'Previous or next item not found' });
        return;
      }

      const newPriority = (previousItem.data()?.priority + nextItem.data()?.priority) / 2;
      newItem = await db.collection('items').add({
        ...itemData,
        priority: newPriority
      });
    } else if (previousId) {
      // Insert after an item
      const previousItem = await db.collection('items').doc(previousId).get();
      if (!previousItem.exists) {
        res.status(404).json({ error: 'Previous item not found' });
        return;
      }

      const newPriority = previousItem.data()?.priority + 1;
      newItem = await db.collection('items').add({
        ...itemData,
        priority: newPriority
      });
    } else if (nextId) {
      // Insert before an item
      const nextItem = await db.collection('items').doc(nextId).get();
      if (!nextItem.exists) {
        res.status(404).json({ error: 'Next item not found' });
        return;
      }

      const newPriority = nextItem.data()?.priority - 1;
      newItem = await db.collection('items').add({
        ...itemData,
        priority: newPriority
      });
    } else {
      // Add to the end
      const lastItem = await db.collection('items')
        .orderBy('priority', 'desc')
        .limit(1)
        .get();

      const newPriority = lastItem.empty ? 0 : lastItem.docs[0].data()?.priority + 1;
      newItem = await db.collection('items').add({
        ...itemData,
        priority: newPriority
      });
    }

    // After creating the item, update parent's children count if it has a parent
    if (parentId) {
      await updateChildrenCount(parentId);
    }

    console.info(`Database insert took ${(performance.now() - startTime).toFixed(2)}ms`);

    const item = await newItem.get();
    // Sync to Algolia
    await syncItemToAlgolia(item.id, item.data());
    res.status(201).json({
      id: item.id,
      ...item.data()
    });
  } catch (error) {
    console.error('Error adding item:', error);
    res.status(500).json({ error: 'Failed to add item' });
  }
});

// Update an item
router.put('/items/:id', async (req: Request<{ id: string }>, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { title, estimation, estimationFormat, startedAt, parentId } = req.body;
    let { priority } = req.body;

    if (!title) {
      res.status(400).json({ error: 'Title is required' });
      return;
    }

    const itemSelectStartTime = performance.now();
    const itemRef = db.collection('items').doc(id);
    const item = await itemRef.get();
    console.info(`Database item select took ${(performance.now() - itemSelectStartTime).toFixed(2)}ms`);

    if (!item.exists) {
      res.status(404).json({ error: 'Item not found' });
      return;
    }

    // Get the old parent ID before update
    const oldParentId = item.data()?.parentId;

    const updateStartTime = performance.now();

    if (parentId && (oldParentId !== parentId)) {

      const topChild = await db.collection('items')
        .where('parentId', '==', parentId)
        .orderBy('priority')
        .limit(1)
        .get();

      if (!topChild.empty) {
        priority = topChild.docs[0].data()?.priority - 1;
      }
    }

    await itemRef.update({
      title,
      ...(estimation !== undefined && { estimation }),
      ...(estimationFormat && { estimationFormat }),
      ...(priority !== undefined && { priority }),
      ...(startedAt !== undefined && { startedAt }),
      ...(parentId !== undefined && { parentId })
    });

    if (oldParentId !== parentId) {
      // Update children count for both old and new parent
      if (oldParentId) {
        await updateChildrenCount(oldParentId);
      }

      if (parentId) {
        await updateChildrenCount(parentId);
      }
    }

    console.info(`Database update took ${(performance.now() - updateStartTime).toFixed(2)}ms`);

    const updatedItem = await itemRef.get();
    // Sync to Algolia
    await syncItemToAlgolia(updatedItem.id, updatedItem.data());
    res.json({
      id: updatedItem.id,
      ...updatedItem.data()
    });
  } catch (error) {
    console.error('Error updating item:', error);
    res.status(500).json({ error: 'Failed to update item' });
  }
});

// Delete an item
router.delete('/items/:id', async (req: Request<{ id: string }>, res: Response): Promise<void> => {
  const startTime = performance.now();
  try {
    const { id } = req.params;
    const itemRef = db.collection('items').doc(id);
    const item = await itemRef.get();

    if (!item.exists) {
      res.status(404).json({ error: 'Item not found' });
      return;
    }

    // Get parent ID before deleting
    const parentId = item.data()?.parentId;

    await itemRef.delete();
    // Remove from Algolia
    await deleteItemFromAlgolia(id);

    // Update parent's children count
    if (parentId) {
      await updateChildrenCount(parentId);
    }

    console.info(`Database delete took ${(performance.now() - startTime).toFixed(2)}ms`);

    res.status(204).send();
  } catch (error) {
    console.error('Error deleting item:', error);
    res.status(500).json({ error: 'Failed to delete item' });
  }
});

// Move an item
router.put('/items/:id/move', async (req: Request<{ id: string }>, res: Response): Promise<void> => {
  const startTime = performance.now();
  try {
    const { id } = req.params;
    const { previousId, nextId, parentId } = req.body;

    const itemRef = db.collection('items').doc(id);
    const item = await itemRef.get();

    if (!item.exists) {
      res.status(404).json({ error: 'Item not found' });
      return;
    }

    // Get old parent ID before update
    const oldParentId = item.data()?.parentId;

    let newPriority;

    if (previousId && nextId) {
      // Move between two items
      const [previousItem, nextItem] = await Promise.all([
        db.collection('items').doc(previousId).get(),
        db.collection('items').doc(nextId).get()
      ]);

      if (!previousItem.exists || !nextItem.exists) {
        res.status(404).json({ error: 'Previous or next item not found' });
        return;
      }

      newPriority = (previousItem.data()?.priority + nextItem.data()?.priority) / 2;
    } else if (previousId) {
      // Move after an item
      const previousItem = await db.collection('items').doc(previousId).get();
      if (!previousItem.exists) {
        res.status(404).json({ error: 'Previous item not found' });
        return;
      }

      newPriority = previousItem.data()?.priority + 1;
    } else if (nextId) {
      // Move before an item
      const nextItem = await db.collection('items').doc(nextId).get();
      if (!nextItem.exists) {
        res.status(404).json({ error: 'Next item not found' });
        return;
      }

      newPriority = nextItem.data()?.priority - 1;
    } else {
      // Move to the beginning
      const firstItem = await db.collection('items')
        .orderBy('priority')
        .limit(1)
        .get();

      newPriority = firstItem.empty ? 0 : firstItem.docs[0].data()?.priority - 1;
    }

    // Update priority and parentId if provided
    const updateData: Record<string, any> = { priority: newPriority };
    if (parentId !== undefined) {
      updateData.parentId = parentId;
    }

    await itemRef.update(updateData);

    // Update children count for both old and new parent
    if (oldParentId !== parentId) {
      if (oldParentId) {
        await updateChildrenCount(oldParentId);
      }
      if (parentId) {
        await updateChildrenCount(parentId);
      }
    }

    console.info(`Database move took ${(performance.now() - startTime).toFixed(2)}ms`);

    const updatedItem = await itemRef.get();
    // Sync to Algolia
    await syncItemToAlgolia(updatedItem.id, updatedItem.data());
    res.json({
      id: updatedItem.id,
      ...updatedItem.data()
    });
  } catch (error) {
    console.error('Error moving item:', error);
    res.status(500).json({ error: 'Failed to move item' });
  }
});

// Update lastFilteredAt for an item
router.patch('/items/:id/last-filtered', async (req: Request<{ id: string }>, res: Response) => {
  try {
    const { id } = req.params;
    const { lastFilteredAt } = req.body;
    if (!lastFilteredAt) {
      res.status(400).json({ error: 'lastFilteredAt is required' });
      return;
    }
    const itemRef = db.collection('items').doc(id);
    const item = await itemRef.get();
    if (!item.exists) {
      res.status(404).json({ error: 'Item not found' });
      return;
    }
    await itemRef.update({ lastFilteredAt });
    // Sync to Algolia
    const updated = await itemRef.get();
    await syncItemToAlgolia(updated.id, updated.data());
    res.status(204).send();
  } catch (error) {
    console.error('Error updating lastFilteredAt:', error);
    res.status(500).json({ error: 'Failed to update lastFilteredAt' });
  }
});

// Constants for item queries
const ITEMS_LIMIT = 15;

// Optimized endpoint for both recent items and autocomplete
router.get('/parents-autocomplete', async (req, res) => {
  try {
    const collectionStartTime = performance.now();
    const { q, limit = ITEMS_LIMIT } = req.query;
    const searchTerm = (q as string) || '';
    const queryLimit = Math.min(Number(limit), ITEMS_LIMIT);

    let items: Array<Item & { id: string }> = [];

    if (searchTerm.trim().length >= 2 && algoliaIndex) {
      // Query Algolia for contains/infix search
      const result = await algoliaIndex.search(searchTerm, { hitsPerPage: queryLimit });
      items = (result.hits as any[]).map(hit => {
        const { objectID, ...rest } = hit;
        return { id: objectID as string, ...(rest as any) } as Item & { id: string };
      });
    } else {
      // No filter: order by lastFilteredAt desc
      const snapshot = await db.collection('items')
        .orderBy('lastFilteredAt', 'desc')
        .limit(queryLimit)
        .get();

      items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Array<Item & { id: string }>;
    }

    console.info(`Parents-autocomplete: ${(performance.now() - collectionStartTime).toFixed(2)}ms, ${items.length} items`);
    res.json(items);
  } catch (error) {
    console.error('Error fetching items:', error);
    res.status(500).json({ error: 'Failed to fetch items' });
  }
});

// Use the router
app.use('/', router);

app.listen(Number(port), () => {
  console.log(`Server running on port ${port}`);
});
