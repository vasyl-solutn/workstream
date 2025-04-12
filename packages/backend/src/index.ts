import express, { Request, Response } from 'express';
import cors from 'cors';
import { db } from './db';
import * as admin from 'firebase-admin';
import { CreateItemDto, Item } from '@workstream/shared';

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

// Add a new item to the database
app.post('/items', async (req, res) => {
  try {
    const { title, estimation, priority, previousId, nextId }: CreateItemDto = req.body;

    const previousItem = previousId ? await db.collection('items').doc(previousId).get() : null;
    const nextItem = nextId ? await db.collection('items').doc(nextId).get() : null;

    let newPriority;
    if (previousItem && !nextItem) {
      newPriority = previousItem.data()?.priority + Math.random();
    } else if (!previousItem && nextItem) {
      newPriority = nextItem.data()?.priority - Math.random();
    } else if (previousItem && nextItem) {
      newPriority = (previousItem.data()?.priority + nextItem.data()?.priority) / 2;
    } else {
      newPriority = Math.random();
    }

    const newItem = {
      title: title || `Task ${Math.floor(Math.random() * 1000)}`,
      estimation: estimation !== undefined ? Number(estimation) : Math.floor(Math.random() * 10) + 1,
      priority: newPriority,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    };

    const docRef = await db.collection('items').add(newItem);
    const doc = await docRef.get();
    const data = doc.data();

    res.status(201).json({
      id: docRef.id,
      ...data
    });
  } catch (error) {
    console.error('Error adding item:', error);
    res.status(500).json({ error: 'Failed to add item' });
  }
});

// Get all items from the database
app.get('/items', async (req, res) => {
  try {
    const snapshot = await db.collection('items').get();

    const items = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    res.json(items);
  } catch (error) {
    console.error('Error getting items:', error);
    res.status(500).json({ error: 'Failed to get items' });
  }
});

// Delete an item from the database
app.delete('/items/:id', async (req, res) => {
  try {
    const { id } = req.params;

    await db.collection('items').doc(id).delete();

    res.status(200).json({ success: true, message: 'Item deleted successfully' });
  } catch (error) {
    console.error('Error deleting item:', error);
    res.status(500).json({ error: 'Failed to delete item' });
  }
});

app.put('/items/:id/move', async (req, res) => {
  try {
    const { id } = req.params;
    const { previousId, nextId } = req.body;

    // Get the items for priority calculation
    const prevItem = previousId ? (await db.collection('items').doc(previousId).get()).data() : null;
    const nextItem = nextId ? (await db.collection('items').doc(nextId).get()).data() : null;

    // Calculate new priority
    let newPriority;
    if (!prevItem) {
      // Moving to the start
      newPriority = nextItem ? nextItem.priority - 1 : 1;
    } else if (!nextItem) {
      // Moving to the end
      newPriority = prevItem.priority + 1;
    } else {
      // Moving between two items
      newPriority = (prevItem.priority + nextItem.priority) / 2;
    }

    // Update the item
    await db.collection('items').doc(id).update({
      priority: newPriority
    });

    // Get and return the updated item
    const updatedDoc = await db.collection('items').doc(id).get();
    res.json({
      id: updatedDoc.id,
      ...updatedDoc.data()
    });
  } catch (error) {
    console.error('Error moving item:', error);
    res.status(500).json({ error: 'Failed to move item' });
  }
});

// Update an item
app.put('/items/:id', (async (req, res) => {
  try {
    const { id } = req.params;
    const { title, estimation, priority } = req.body as { title: string; estimation?: number; priority?: number };

    if (!title) {
      return res.status(400).json({ error: 'Title is required' });
    }

    const updateData: Partial<Item> = {
      title,
      ...(estimation !== undefined && { estimation: Number(estimation) }),
      ...(priority !== undefined && { priority: Number(priority) })
    };

    await db.collection('items').doc(id).update(updateData);

    // Get and return the updated item
    const updatedDoc = await db.collection('items').doc(id).get();
    res.json({
      id: updatedDoc.id,
      ...updatedDoc.data()
    });
  } catch (error) {
    console.error('Error updating item:', error);
    res.status(500).json({ error: 'Failed to update item' });
  }
}) as express.RequestHandler);

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
