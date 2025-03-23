import React, { useState, useEffect } from 'react'
import './App.css'
import { API_URL } from './config/api'
import { FaPlus, FaTimes } from 'react-icons/fa'
import Modal from './components/Modal'
import { IoAdd, IoTrashOutline, IoMove, IoPasteOutline } from 'react-icons/io5'

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
}

function App() {
  const [message, setMessage] = useState('Loading...')
  const [items, setItems] = useState<Item[]>([])
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState<FormData>({
    title: '',
    estimation: 0
  })
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [currentContext, setCurrentContext] = useState<{
    previousId: string | null;
    nextId: string | null;
  }>({ previousId: null, nextId: null });
  const [selectedItem, setSelectedItem] = useState<string | null>(null);

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
      const response = await fetch(`${API_URL}/items`);
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
      [name]: name === 'estimation' ? Number(value) : value
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
      const response = await fetch(`${API_URL}/items`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: formData.title,
          estimation: formData.estimation,
          previousId: currentContext.previousId,
          nextId: currentContext.nextId
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to add item');
      }

      const newItem = await response.json();
      setItems(prevItems => [...prevItems, newItem]);
      setFormData({ title: '', estimation: 0 });
      setIsModalOpen(false);
      setCurrentContext({ previousId: null, nextId: null }); // Reset context
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
      const response = await fetch(`${API_URL}/items/${id}`, {
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

  const handleMove = async (previousId: string | null, nextId: string | null) => {
    if (!selectedItem) return;

    try {
      const response = await fetch(`${API_URL}/items/${selectedItem}/move`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          previousId,
          nextId,
        }),
      });

      if (!response.ok) throw new Error('Failed to move item');

      const updatedItem = await response.json();
      setItems(prevItems =>
        prevItems.map(item =>
          item.id === selectedItem ? updatedItem : item
        )
      );
      setSelectedItem(null); // Clear selection after move
    } catch (error) {
      console.error('Error moving item:', error);
      alert('Failed to move item');
    }
  };

  const sortedItems = [...items].sort((a, b) => a.priority - b.priority);

  const handleAddBetween = (previousId: string | null, nextId: string | null) => {
    setCurrentContext({ previousId, nextId });
    setIsModalOpen(true);
  };

  const handleOutsideClick = (e: React.MouseEvent) => {
    // Don't clear if clicking on move button, paste button, or selected item
    if (
      (e.target as HTMLElement).closest('.move-button') ||
      (e.target as HTMLElement).closest('.paste-button') ||
      (e.target as HTMLElement).closest('.selected')
    ) {
      return;
    }
    setSelectedItem(null);
  };

  return (
    <div className="items-grid" onClick={handleOutsideClick}>
      <div className="item-wrapper">
        {!selectedItem ? (
          <button
            className="add-between-button"
            onClick={() => handleAddBetween(null, sortedItems[0]?.id || null)}
          >
            <IoAdd />
          </button>
        ) : (
          <button
            className="dot-button"
            onClick={() => handleMove(null, sortedItems[0]?.id || null)}
            title="Paste here"
          >
            •
          </button>
        )}
      </div>

      {sortedItems.map((item, index) => (
        <div key={item.id} className="item-wrapper">
          <article className={`item-card ${selectedItem === item.id ? 'selected' : ''}`}>
            <div className="item-content">
              <div className="item-header">
                <h3>{item.title}</h3>
                <div className="item-actions">
                  <button
                    className="icon-button move-button"
                    onClick={() => setSelectedItem(item.id)}
                    disabled={selectedItem === item.id}
                  >
                    <IoMove />
                  </button>
                  <button
                    className="icon-button delete-button"
                    onClick={() => deleteItem(item.id)}
                  >
                    <IoTrashOutline />
                  </button>
                </div>
              </div>
              <div className="item-details">
                <span className="estimation">{item.estimation}p</span>
                <span className="date">{formatDate(item.createdAt)}</span>
              </div>
              <div className="priority-row">
                {item.priority}
              </div>
            </div>
          </article>

          <div className="action-buttons">
            {!selectedItem ? (
              <button
                className="add-between-button"
                onClick={() => handleAddBetween(
                  item.id,
                  sortedItems[index + 1]?.id || null
                )}
              >
                <IoAdd />
              </button>
            ) : selectedItem !== item.id && (
              <button
                className="dot-button"
                onClick={() => handleMove(item.id, sortedItems[index + 1]?.id || null)}
                title="Paste here"
              >
                •
              </button>
            )}
          </div>
        </div>
      ))}

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)}>
        <form onSubmit={handleSubmit} className="item-form">
          <div className="form-group">
            <label htmlFor="title">Title:</label>
            <input
              type="text"
              id="title"
              name="title"
              value={formData.title}
              onChange={handleInputChange}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="estimation">Points:</label>
            <input
              type="number"
              id="estimation"
              name="estimation"
              value={formData.estimation}
              onChange={handleInputChange}
              min="0"
            />
          </div>

          <button type="submit" className="submit-button">
            Add Item
          </button>
        </form>
      </Modal>
    </div>
  )
}

export default App
