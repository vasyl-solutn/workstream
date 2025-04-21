import express, { Request, Response, RequestHandler } from 'express';
import cors from 'cors';
import { db } from './db';
import * as admin from 'firebase-admin';
import { CreateItemDto, Item } from '@workstream/shared';
import { ParamsDictionary } from 'express-serve-static-core';

type AsyncRequestHandler<P = ParamsDictionary, ResBody = any, ReqBody = any> = (
  req: Request<P, ResBody, ReqBody>,
  res: Response
) => Promise<void>;

const app = express();
const port = process.env.PORT || 8080;

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.json({ message: 'Welcome to Workstream API' });
});

// Example endpoint using Firestore
app.get('/api/test', async (req, res) => {
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
app.get('/items', async (req: Request, res: Response) => {
  const startTime = performance.now();
  try {
    const snapshot = await db.collection('items').orderBy('priority').get();
    const items = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    const endTime = performance.now();
    console.info(`Database query took ${(endTime - startTime).toFixed(2)}ms`);
    res.json(items);
  } catch (error) {
    console.error('Error fetching items:', error);
    res.status(500).json({ error: 'Failed to fetch items' });
  }
});

// Add a new item
app.post('/items', (async (req: Request<ParamsDictionary, any, CreateItemDto>, res: Response) => {
  const startTime = performance.now();
  try {
    const { title, estimation, estimationFormat, priority, previousId, nextId } = req.body;

    if (!title) {
      return res.status(400).json({ error: 'Title is required' });
    }

    const itemData = {
      title,
      estimation: estimation || 0,
      estimationFormat: estimationFormat || 'points',
      priority: priority || 0,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    };

    let newItem;
    if (previousId && nextId) {
      // Insert between two items
      const [previousItem, nextItem] = await Promise.all([
        db.collection('items').doc(previousId).get(),
        db.collection('items').doc(nextId).get()
      ]);

      if (!previousItem.exists || !nextItem.exists) {
        return res.status(404).json({ error: 'Previous or next item not found' });
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
        return res.status(404).json({ error: 'Previous item not found' });
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
        return res.status(404).json({ error: 'Next item not found' });
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

    const endTime = performance.now();
    console.info(`Database insert took ${(endTime - startTime).toFixed(2)}ms`);

    const item = await newItem.get();
    res.status(201).json({
      id: item.id,
      ...item.data()
    });
  } catch (error) {
    console.error('Error adding item:', error);
    res.status(500).json({ error: 'Failed to add item' });
  }
}) as AsyncRequestHandler<ParamsDictionary, any, CreateItemDto>);

// Update an item
app.put('/items/:id', (async (req: Request<ParamsDictionary & { id: string }, any, Partial<Item>>, res: Response) => {
  const startTime = performance.now();
  try {
    const { id } = req.params;
    const { title, estimation, estimationFormat, priority } = req.body;

    if (!title) {
      return res.status(400).json({ error: 'Title is required' });
    }

    const itemRef = db.collection('items').doc(id);
    const item = await itemRef.get();

    if (!item.exists) {
      return res.status(404).json({ error: 'Item not found' });
    }

    await itemRef.update({
      title,
      ...(estimation !== undefined && { estimation }),
      ...(estimationFormat && { estimationFormat }),
      ...(priority !== undefined && { priority })
    });

    const endTime = performance.now();
    console.info(`Database update took ${(endTime - startTime).toFixed(2)}ms`);

    const updatedItem = await itemRef.get();
    res.json({
      id: updatedItem.id,
      ...updatedItem.data()
    });
  } catch (error) {
    console.error('Error updating item:', error);
    res.status(500).json({ error: 'Failed to update item' });
  }
}) as AsyncRequestHandler<ParamsDictionary & { id: string }, any, Partial<Item>>);

// Delete an item
app.delete('/items/:id', (async (req: Request<ParamsDictionary & { id: string }>, res: Response) => {
  const startTime = performance.now();
  try {
    const { id } = req.params;
    const itemRef = db.collection('items').doc(id);
    const item = await itemRef.get();

    if (!item.exists) {
      return res.status(404).json({ error: 'Item not found' });
    }

    await itemRef.delete();
    const endTime = performance.now();
    console.info(`Database delete took ${(endTime - startTime).toFixed(2)}ms`);

    res.status(204).send();
  } catch (error) {
    console.error('Error deleting item:', error);
    res.status(500).json({ error: 'Failed to delete item' });
  }
}) as AsyncRequestHandler<ParamsDictionary & { id: string }>);

// Move an item
app.put('/items/:id/move', (async (req: Request<ParamsDictionary & { id: string }, any, { previousId?: string; nextId?: string }>, res: Response) => {
  const startTime = performance.now();
  try {
    const { id } = req.params;
    const { previousId, nextId } = req.body;

    const itemRef = db.collection('items').doc(id);
    const item = await itemRef.get();

    if (!item.exists) {
      return res.status(404).json({ error: 'Item not found' });
    }

    let newPriority;

    if (previousId && nextId) {
      // Move between two items
      const [previousItem, nextItem] = await Promise.all([
        db.collection('items').doc(previousId).get(),
        db.collection('items').doc(nextId).get()
      ]);

      if (!previousItem.exists || !nextItem.exists) {
        return res.status(404).json({ error: 'Previous or next item not found' });
      }

      newPriority = (previousItem.data()?.priority + nextItem.data()?.priority) / 2;
    } else if (previousId) {
      // Move after an item
      const previousItem = await db.collection('items').doc(previousId).get();
      if (!previousItem.exists) {
        return res.status(404).json({ error: 'Previous item not found' });
      }

      newPriority = previousItem.data()?.priority + 1;
    } else if (nextId) {
      // Move before an item
      const nextItem = await db.collection('items').doc(nextId).get();
      if (!nextItem.exists) {
        return res.status(404).json({ error: 'Next item not found' });
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

    await itemRef.update({ priority: newPriority });
    const endTime = performance.now();
    console.info(`Database move took ${(endTime - startTime).toFixed(2)}ms`);

    const updatedItem = await itemRef.get();
    res.json({
      id: updatedItem.id,
      ...updatedItem.data()
    });
  } catch (error) {
    console.error('Error moving item:', error);
    res.status(500).json({ error: 'Failed to move item' });
  }
}) as AsyncRequestHandler<ParamsDictionary & { id: string }, any, { previousId?: string; nextId?: string }>);

app.listen(Number(port), () => {
  console.log(`Server running on port ${port}`);
});
