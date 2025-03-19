import { useState, useEffect } from 'react'
import './App.css'
import { API_URL } from './config/api'
import { FaPlus, FaTrash, FaTimes } from 'react-icons/fa'

interface Item {
  id: string;
  title: string;
  estimation: number;
  priority: number;
  createdAt: any;
}

function App() {
  const [message, setMessage] = useState('Loading...')
  const [items, setItems] = useState<Item[]>([])
  const [loading, setLoading] = useState(false)

  // Fetch welcome message
  useEffect(() => {
    fetch(`${API_URL}/`)
      .then(response => response.json())
      .then(data => setMessage(data.message))
      .catch(error => {
        console.error('Error connecting to API:', error)
        setMessage('Error connecting to API')
      })
  }, [])

  // Fetch all items
  const fetchItems = async () => {
    try {
      const response = await fetch(`${API_URL}/api/items`);
      if (!response.ok) throw new Error('Failed to fetch items');
      const data = await response.json();

      // Debug timestamps
      console.log('Items received:', data);

      setItems(data);
    } catch (error) {
      console.error('Error fetching items:', error);
    }
  };

  // Add a random item
  const addRandomItem = async () => {
    setLoading(true)
    try {
      const response = await fetch(`${API_URL}/api/items`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({})
      })

      if (!response.ok) throw new Error('Failed to add item')

      // Refresh the list
      fetchItems()
    } catch (error) {
      console.error('Error adding item:', error)
    } finally {
      setLoading(false)
    }
  }

  // Load items on initial render
  useEffect(() => {
    fetchItems()
  }, [])

  // Format timestamp
  const formatDate = (timestamp: any) => {
    if (!timestamp) return 'Just now';

    try {
      // Handle Firestore Timestamp objects (from Firestore SDK)
      if (timestamp.toDate && typeof timestamp.toDate === 'function') {
        return timestamp.toDate().toLocaleString();
      }

      // Handle server timestamp objects (after JSON serialization)
      if (timestamp.seconds !== undefined && timestamp.nanoseconds !== undefined) {
        const date = new Date(timestamp.seconds * 1000 + timestamp.nanoseconds / 1000000);
        return date.toLocaleString();
      }

      // Handle regular Date objects or ISO strings
      if (timestamp instanceof Date || typeof timestamp === 'string') {
        return new Date(timestamp).toLocaleString();
      }

      // For debugging
      console.log('Unknown timestamp format:', timestamp);
      return 'Unknown date format';
    } catch (error) {
      console.error('Error formatting date:', error, timestamp);
      return 'Date error';
    }
  };

  // Get priority label and color
  const getPriorityInfo = (priority: number) => {
    switch(priority) {
      case 1:
        return { label: 'High', color: '#d84315' };
      case 2:
        return { label: 'Medium', color: '#fb8c00' };
      case 3:
        return { label: 'Low', color: '#7cb342' };
      default:
        return { label: 'Unknown', color: '#9e9e9e' };
    }
  };

  // Delete an item
  const deleteItem = async (id: string) => {
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/items/${id}`, {
        method: 'DELETE'
      });

      if (!response.ok) throw new Error('Failed to delete item');

      // Remove the item from state instead of refetching all items
      setItems(prevItems => prevItems.filter(item => item.id !== id));
    } catch (error) {
      console.error('Error deleting item:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="App">
      <div className="container">
        <header className="App-header">
          <h1>Workstream</h1>
          <p>{message}</p>

          <div className="card">
            <button
              className="add-button"
              onClick={addRandomItem}
              disabled={loading}
            >
              {loading ? 'Adding...' : <><FaPlus style={{marginRight: '8px'}} /> Add Random Item</>}
            </button>
          </div>
        </header>

        <main>
          <h2>Items from Database</h2>
          {items.length === 0 ? (
            <p>No items yet. Add some by clicking the button above!</p>
          ) : (
            <ul className="items-list">
              {items.map(item => {
                const priorityInfo = getPriorityInfo(item.priority);

                return (
                  <li key={item.id} className="item-card">
                    <div className="item-header">
                      <h3>{item.title}</h3>
                      <div
                        className="priority-badge"
                        style={{ backgroundColor: priorityInfo.color }}
                      >
                        {priorityInfo.label}
                      </div>
                    </div>
                    <div className="item-footer">
                      <div className="item-info">
                        <span className="estimation">Points: {item.estimation}</span>
                        <small>Created: {formatDate(item.createdAt)}</small>
                      </div>
                      <button
                        className="delete-btn"
                        onClick={() => deleteItem(item.id)}
                        disabled={loading}
                        aria-label="Delete item"
                      >
                        <FaTimes />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </main>
      </div>
    </div>
  )
}

export default App
