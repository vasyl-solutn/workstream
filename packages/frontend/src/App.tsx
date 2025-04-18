import React, { useState, useEffect } from 'react'
import './App.css'
import { API_URL } from './config/api'
import Modal from './components/Modal'
import { IoAdd, IoTrashOutline, IoMove } from 'react-icons/io5'
import { Item, CreateItemDto } from '@workstream/shared'

interface Timestamp {
  toDate?: () => Date;
  seconds?: number;
  nanoseconds?: number;
  _seconds?: number;
  _nanoseconds?: number;
}

interface ExtendedItem extends Item {
  highlight?: boolean;
  isEditing?: boolean;
  isEditingEstimation?: boolean;
}

function App() {
  const [message, setMessage] = useState('Loading...')
  const [items, setItems] = useState<ExtendedItem[]>([])
  const [formData, setFormData] = useState<CreateItemDto>({
    title: '',
    estimation: 0,
    priority: 0
  })
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [currentContext, setCurrentContext] = useState<{
    previousId: string | null;
    nextId: string | null;
  }>({ previousId: null, nextId: null });
  const [selectedItem, setSelectedItem] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [editingTitle, setEditingTitle] = useState('');
  const [editingEstimation, setEditingEstimation] = useState(0);

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
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'estimation' || name === 'priority' ? Number(value) : value
    }));
  };

  // Add a new item
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title?.trim()) {
      alert('Please enter a title');
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(`${API_URL}/items`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...formData,
          previousId: currentContext.previousId,
          nextId: currentContext.nextId
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to add item');
      }

      const newItem = await response.json();
      const itemWithHighlight = { ...newItem, highlight: true };
      setItems(prevItems => [...prevItems, itemWithHighlight]);
      setFormData({ title: '', estimation: 0, priority: 0 });
      setIsModalOpen(false);
      setCurrentContext({ previousId: null, nextId: null });

      setTimeout(() => {
        setItems(prevItems =>
          prevItems.map(item =>
            item.id === newItem.id ? { ...item, highlight: false } : item
          )
        );
      }, 1500);
    } catch (error) {
      console.error('Error adding item:', error);
      alert('Failed to add item');
    } finally {
      setIsLoading(false);
    }
  };

  // Load items on initial render
  useEffect(() => {
    fetchItems()
  }, [])

  // Format timestamp
  const formatDate = (timestamp: Timestamp | Date | string | null) => {
    if (!timestamp) return 'Just now';

    try {
      // Handle Firestore Timestamp objects (from Firestore SDK)
      if (typeof timestamp === 'object' && 'toDate' in timestamp && typeof timestamp.toDate === 'function') {
        return timestamp.toDate().toLocaleString();
      }

      // Handle server timestamp objects (after JSON serialization)
      if (typeof timestamp === 'object' && 'seconds' in timestamp && 'nanoseconds' in timestamp) {
        const seconds = timestamp.seconds ?? 0;
        const nanoseconds = timestamp.nanoseconds ?? 0;
        const date = new Date(seconds * 1000 + nanoseconds / 1000000);
        return date.toLocaleString();
      }

      // Handle the format with _seconds and _nanoseconds (from BE)
      if (typeof timestamp === 'object' && '_seconds' in timestamp && '_nanoseconds' in timestamp) {
        const seconds = timestamp._seconds ?? 0;
        const nanoseconds = timestamp._nanoseconds ?? 0;
        const date = new Date(seconds * 1000 + nanoseconds / 1000000);
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

  // Delete an item
  const deleteItem = async (id: string | undefined) => {
    if (!id) return;
    setIsLoading(true);
    try {
      const response = await fetch(`${API_URL}/items/${id}`, {
        method: 'DELETE'
      });

      if (!response.ok) throw new Error('Failed to delete item');

      // Remove the item from state instead of refetching all items
      setItems(prevItems => prevItems.filter(item => item.id !== id));
    } catch (error) {
      console.error('Error deleting item:', error);
      alert('Failed to delete item');
    } finally {
      setIsLoading(false);
    }
  };

  const handleMove = async (previousId: string | null, nextId: string | null) => {
    if (!selectedItem) return;

    setIsLoading(true);
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
      const itemWithHighlight = { ...updatedItem, highlight: true };
      setItems(prevItems =>
        prevItems.map(item =>
          item.id === selectedItem ? itemWithHighlight : item
        )
      );
      setSelectedItem(null);

      setTimeout(() => {
        setItems(prevItems =>
          prevItems.map(item =>
            item.id === selectedItem ? { ...item, highlight: false } : item
          )
        );
      }, 1500);
    } catch (error) {
      console.error('Error moving item:', error);
      alert('Failed to move item');
    } finally {
      setIsLoading(false);
    }
  };

  const sortedItems = [...items].sort((a, b) => a.priority - b.priority);

  const handleAddBetween = (previousId: string | null, nextId: string | null) => {
    setCurrentContext({ previousId, nextId });
    setIsModalOpen(true);
  };

  const handleOutsideClick = (e: React.MouseEvent) => {
    // Don't clear if clicking on move button or selected item
    if (
      (e.target as HTMLElement).closest('.move-button') ||
      (e.target as HTMLElement).closest('.selected')
    ) {
      return;
    }
    setSelectedItem(null);
  };

  const handleTitleEdit = (item: ExtendedItem) => {
    setItems(prevItems =>
      prevItems.map(i =>
        i.id === item.id ? { ...i, isEditing: true } : i
      )
    );
    setEditingTitle(item.title);
  };

  const handleTitleSave = async (item: ExtendedItem) => {
    if (!editingTitle.trim()) {
      alert('Title cannot be empty');
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(`${API_URL}/items/${item.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: editingTitle,
          estimation: item.estimation,
          priority: item.priority
        }),
      });

      if (!response.ok) throw new Error('Failed to update title');

      setItems(prevItems =>
        prevItems.map(i =>
          i.id === item.id ? { ...i, title: editingTitle, isEditing: false } : i
        )
      );
    } catch (error) {
      console.error('Error updating title:', error);
      alert('Failed to update title');
    } finally {
      setIsLoading(false);
    }
  };

  const handleTitleCancel = (item: ExtendedItem) => {
    setItems(prevItems =>
      prevItems.map(i =>
        i.id === item.id ? { ...i, isEditing: false } : i
      )
    );
  };

  const handleEstimationEdit = (item: ExtendedItem) => {
    setItems(prevItems =>
      prevItems.map(i =>
        i.id === item.id ? { ...i, isEditingEstimation: true } : i
      )
    );
    setEditingEstimation(item.estimation);
  };

  const handleEstimationSave = async (item: ExtendedItem) => {
    setIsLoading(true);
    try {
      const response = await fetch(`${API_URL}/items/${item.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: item.title,
          estimation: editingEstimation,
          priority: item.priority
        }),
      });

      if (!response.ok) throw new Error('Failed to update estimation');

      setItems(prevItems =>
        prevItems.map(i =>
          i.id === item.id ? { ...i, estimation: editingEstimation, isEditingEstimation: false } : i
        )
      );
    } catch (error) {
      console.error('Error updating estimation:', error);
      alert('Failed to update estimation');
    } finally {
      setIsLoading(false);
    }
  };

  const handleEstimationCancel = (item: ExtendedItem) => {
    setItems(prevItems =>
      prevItems.map(i =>
        i.id === item.id ? { ...i, isEditingEstimation: false } : i
      )
    );
  };

  return (
    <div className="items-grid" onClick={handleOutsideClick}>
      {isLoading && (
        <div className="loading-overlay">
          <div className="loading-spinner"></div>
        </div>
      )}
      <div className="total-estimation">
        Total: {items.reduce((sum, item) => sum + item.estimation, 0)}p
      </div>
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
          <article className={`item-card ${selectedItem === item.id ? 'selected' : ''} ${item.highlight ? 'highlight' : ''}`}>
            <div className="item-content">
              <div className="item-header">
                {item.isEditing ? (
                  <div className="title-edit">
                    <input
                      type="text"
                      value={editingTitle}
                      onChange={(e) => setEditingTitle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handleTitleSave(item);
                        } else if (e.key === 'Escape') {
                          handleTitleCancel(item);
                        }
                      }}
                      autoFocus
                    />
                    <div className="edit-actions">
                      <button onClick={() => handleTitleSave(item)}>Save</button>
                      <button onClick={() => handleTitleCancel(item)}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <h3 onClick={() => handleTitleEdit(item)}>{item.title}</h3>
                )}
                <div className="item-actions">
                  <button
                    className="icon-button move-button"
                    onClick={() => item.id && setSelectedItem(item.id)}
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
                {item.isEditingEstimation ? (
                  <div className="estimation-edit">
                    <input
                      type="number"
                      value={editingEstimation}
                      onChange={(e) => setEditingEstimation(Number(e.target.value))}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handleEstimationSave(item);
                        } else if (e.key === 'Escape') {
                          handleEstimationCancel(item);
                        }
                      }}
                      autoFocus
                    />
                    <div className="edit-actions">
                      <button onClick={() => handleEstimationSave(item)}>Save</button>
                      <button onClick={() => handleEstimationCancel(item)}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <span className="estimation" onClick={() => handleEstimationEdit(item)}>{item.estimation}p</span>
                )}
                <span className="date">{formatDate(item.createdAt)}</span>
              </div>
            </div>
          </article>

          <div className="action-buttons">
            {!selectedItem ? (
              <button
                className="add-between-button"
                onClick={() => handleAddBetween(
                  item.id || null,
                  sortedItems[index + 1]?.id || null
                )}
              >
                <IoAdd />
              </button>
            ) : selectedItem !== item.id && (
              <button
                className="dot-button"
                onClick={() => handleMove(item.id || null, sortedItems[index + 1]?.id || null)}
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
