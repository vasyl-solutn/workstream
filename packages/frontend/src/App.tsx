import React, { useState, useEffect } from 'react'
import './App.css'
import { API_URL } from './config/api'
import { FaPlus, FaTimes } from 'react-icons/fa'
import Modal from './components/Modal'
import { IoAdd, IoTrashOutline } from 'react-icons/io5'

interface Item {
  id: string;
  title: string;
  estimation: number;
  priority: number;
  createdAt: any;
}

interface FormData {
  title: string;
  estimation: number;
  priority: number;
}

function App() {
  const [message, setMessage] = useState('Loading...')
  const [items, setItems] = useState<Item[]>([])
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState<FormData>({
    title: '',
    estimation: 1,
    priority: 2
  })
  const [isModalOpen, setIsModalOpen] = useState(false)

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

  // Handle form input changes
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: name === 'estimation' || name === 'priority' ? Number(value) : value
    });
  };

  // Add a new item
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.title.trim()) {
      alert('Please enter a title');
      return;
    }

    try {
      setLoading(true);
      const response = await fetch(`${API_URL}/api/items`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        throw new Error('Failed to add item');
      }

      const newItem = await response.json();
      setItems(prevItems => [...prevItems, newItem]);
      setFormData({ title: '', estimation: 0, priority: 2 });
      setIsModalOpen(false); // Close the modal after successful submission
    } catch (error) {
      console.error('Error adding item:', error);
      alert('Failed to add item');
    } finally {
      setLoading(false);
    }
  };

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

      // Handle the format with _seconds and _nanoseconds (from BE)
      if (timestamp._seconds !== undefined && timestamp._nanoseconds !== undefined) {
        const date = new Date(timestamp._seconds * 1000 + timestamp._nanoseconds / 1000000);
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
    <div className="items-grid">
      {items.map((item) => (
        <article key={item.id} className="item-card">
          <div className="item-content">
            <div className="item-header">
              <h3>{item.title}</h3>
              <div className="item-actions">
                <button
                  className="icon-button add-sub-item"
                  onClick={() => setIsModalOpen(true)}
                  title="Add new item"
                >
                  <IoAdd />
                </button>
                <button
                  className="icon-button delete-button"
                  onClick={() => deleteItem(item.id)}
                  title="Delete item"
                >
                  <IoTrashOutline />
                </button>
              </div>
            </div>
            <div className="item-details">
              <span className="estimation">{item.estimation}p</span>
              <span
                className="priority"
                style={{
                  backgroundColor: getPriorityInfo(item.priority).color,
                  color: 'white'
                }}
              >
                {getPriorityInfo(item.priority).label}
              </span>
              <span className="date">{formatDate(item.createdAt)}</span>
            </div>
          </div>
        </article>
      ))}

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)}>
        <form onSubmit={handleSubmit} className="item-form">
          <div className="form-group">
            <label htmlFor="title">Title</label>
            <input
              type="text"
              id="title"
              name="title"
              value={formData.title}
              onChange={handleInputChange}
              placeholder="Enter task title"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="estimation">Points</label>
            <input
              type="number"
              id="estimation"
              name="estimation"
              min="1"
              max="10"
              value={formData.estimation}
              onChange={handleInputChange}
            />
          </div>

          <div className="form-group">
            <label htmlFor="priority">Priority</label>
            <select
              id="priority"
              name="priority"
              value={formData.priority}
              onChange={handleInputChange}
            >
              <option value={1}>High</option>
              <option value={2}>Medium</option>
              <option value={3}>Low</option>
            </select>
          </div>

          <button
            type="submit"
            className="submit-button"
            disabled={loading}
          >
            {loading ? 'Adding...' : 'Submit'}
          </button>
        </form>
      </Modal>
    </div>
  )
}

export default App
