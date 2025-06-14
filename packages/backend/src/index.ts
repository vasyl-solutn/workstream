import express, { Express, Request, Response, Router, RequestHandler } from 'express';
import cors from 'cors';
import { db } from './db';
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
const port = process.env.PORT || 8080;
const router = express.Router() as Router;

app.use(cors());
app.use(express.json());

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
      console.dir(allItems);
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

    console.info(`Database query took ${(performance.now() - collectionStartTime).toFixed(2)}ms`);
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
  if (!parentId) return;

  const childrenSnapshot = await db.collection('items')
    .where('parentId', '==', parentId)
    .get();

  const childrenCount = childrenSnapshot.size;

  await db.collection('items').doc(parentId).update({
    childrenCount
  });
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
    res.status(204).send();
  } catch (error) {
    console.error('Error updating lastFilteredAt:', error);
    res.status(500).json({ error: 'Failed to update lastFilteredAt' });
  }
});

// Use the router
app.use('/', router);

app.listen(Number(port), () => {
  console.log(`Server running on port ${port}`);
});
