import express from 'express';
import cors from 'cors';
import { db } from './db';
import * as admin from 'firebase-admin';

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
app.post('/api/items', async (req, res) => {
  try {
    const { title, estimation, priority } = req.body;

    // Default values or use random if not provided
    const newItem = {
      title: title || `Task ${Math.floor(Math.random() * 1000)}`,
      estimation: estimation !== undefined ? Number(estimation) : Math.floor(Math.random() * 10) + 1,
      priority: priority !== undefined ? Number(priority) : Math.floor(Math.random() * 3) + 1,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    };

    const docRef = await db.collection('items').add(newItem);

    // Get the document after it's been created to include the server timestamp
    const doc = await docRef.get();
    const data = doc.data();

    // Return the data with ID
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
app.get('/api/items', async (req, res) => {
  try {
    const snapshot = await db.collection('items')
      .orderBy('createdAt', 'desc')
      .get();

    const items = snapshot.docs.map(doc => {
      const data = doc.data();
      // Ensure createdAt is properly formatted for JSON response
      return {
        id: doc.id,
        ...data,
        // If createdAt exists, keep it as is (it will be serialized by Express)
      };
    });

    res.json(items);
  } catch (error) {
    console.error('Error getting items:', error);
    res.status(500).json({ error: 'Failed to get items' });
  }
});

// Delete an item from the database
app.delete('/api/items/:id', async (req, res) => {
  try {
    const { id } = req.params;

    await db.collection('items').doc(id).delete();

    res.status(200).json({ success: true, message: 'Item deleted successfully' });
  } catch (error) {
    console.error('Error deleting item:', error);
    res.status(500).json({ error: 'Failed to delete item' });
  }
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
