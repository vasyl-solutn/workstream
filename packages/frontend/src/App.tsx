import React, { useState, useEffect, useRef } from 'react'
import './App.css'
import { API_URL } from './config/api'
import Modal from './components/Modal'
import { IoAdd, IoTrashOutline, IoMove, IoPlay, IoStop } from 'react-icons/io5'
import { Item, CreateItemDto } from '@workstream/shared'

interface ExtendedItem extends Item {
  highlight?: boolean;
  isEditing?: boolean;
  isEditingEstimation?: boolean;
  isRunning?: boolean;
  remainingSeconds?: number;
}

function App() {
  const [items, setItems] = useState<ExtendedItem[]>([])
  const [formData, setFormData] = useState<CreateItemDto>({
    title: '',
    estimation: 0,
    estimationFormat: 'points',
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
  const [completedTimerId, setCompletedTimerId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [editingEstimationText, setEditingEstimationText] = useState('');

  // Initialize audio
  useEffect(() => {
    audioRef.current = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
  }, []);

  // Reset completion animation after it finishes
  useEffect(() => {
    if (completedTimerId) {
      const timer = setTimeout(() => {
        setCompletedTimerId(null);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [completedTimerId]);

  // Timer effect
  useEffect(() => {
    const timer = setInterval(() => {
      setItems(prevItems =>
        prevItems.map(item => {
          if (item.isRunning && item.remainingSeconds && item.remainingSeconds > 0) {
            return { ...item, remainingSeconds: item.remainingSeconds - 1 };
          } else if (item.isRunning && item.remainingSeconds === 0) {
            if (audioRef.current) {
              audioRef.current.play().catch(error => console.log('Audio play failed:', error));
            }
            if (item.id) {
              setCompletedTimerId(item.id);
            }
            // Update estimation in backend
            const updateEstimation = async () => {
              try {
                const response = await fetch(`${API_URL}/items/${item.id}`, {
                  method: 'PUT',
                  headers: {
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({
                    title: item.title,
                    estimation: Math.ceil((item.remainingSeconds || 0) / 60), // Convert back to minutes
                    priority: item.priority
                  }),
                });

                if (!response.ok) throw new Error('Failed to update estimation');

                const updatedItem = await response.json();
                setItems(prevItems =>
                  prevItems.map(i =>
                    i.id === item.id ? { ...i, isRunning: false, estimation: updatedItem.estimation } : i
                  )
                );
              } catch (error) {
                console.error('Error updating estimation:', error);
              }
            };
            updateEstimation();
            return { ...item, isRunning: false };
          }
          return item;
        })
      );
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Fetch all items
  const fetchItems = async () => {
    try {
      const response = await fetch(`${API_URL}/items`);
      if (!response.ok) throw new Error('Failed to fetch items');
      const data = await response.json();
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
      setFormData({ title: '', estimation: 0, estimationFormat: 'points', priority: 0 });
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
    setEditingEstimationText(formatEstimation(item.estimation, item.estimationFormat || 'points'));
  };

  const handleEstimationSave = async (item: ExtendedItem) => {
    const value = editingEstimationText;

    // If it's a time format, validate and convert to minutes
    if (value.includes(':')) {
      const [minutes, seconds] = value.split(':');
      const mins = parseInt(minutes) || 0;
      const secs = parseInt(seconds || '0');

      if (secs >= 0 && secs < 60) {
        const newEstimation = mins + (secs / 60);
        setIsLoading(true);
        try {
          const response = await fetch(`${API_URL}/items/${item.id}`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              title: item.title,
              estimation: newEstimation,
              estimationFormat: 'time',
              priority: item.priority
            }),
          });

          if (!response.ok) throw new Error('Failed to update estimation');

          setItems(prevItems =>
            prevItems.map(i =>
              i.id === item.id ? { ...i, estimation: newEstimation, estimationFormat: 'time', isEditingEstimation: false } : i
            )
          );
        } catch (error) {
          console.error('Error updating estimation:', error);
          alert('Failed to update estimation');
        } finally {
          setIsLoading(false);
        }
      } else {
        alert('Seconds must be between 00 and 59');
      }
    } else {
      // Handle plain number input
      const num = parseFloat(value);
      if (!isNaN(num)) {
        setIsLoading(true);
        try {
          const response = await fetch(`${API_URL}/items/${item.id}`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              title: item.title,
              estimation: num,
              estimationFormat: 'points',
              priority: item.priority
            }),
          });

          if (!response.ok) throw new Error('Failed to update estimation');

          setItems(prevItems =>
            prevItems.map(i =>
              i.id === item.id ? { ...i, estimation: num, estimationFormat: 'points', isEditingEstimation: false } : i
            )
          );
        } catch (error) {
          console.error('Error updating estimation:', error);
          alert('Failed to update estimation');
        } finally {
          setIsLoading(false);
        }
      }
    }
  };

  const handleEstimationCancel = (item: ExtendedItem) => {
    setItems(prevItems =>
      prevItems.map(i =>
        i.id === item.id ? { ...i, isEditingEstimation: false } : i
      )
    );
  };

  const handleStartTimer = (item: ExtendedItem) => {
    setItems(prevItems =>
      prevItems.map(i =>
        i.id === item.id
          ? { ...i, isRunning: true, remainingSeconds: (item.estimation * 60) }
          : i
      )
    );
  };

  const handleStopTimer = (item: ExtendedItem) => {
    setItems(prevItems =>
      prevItems.map(i =>
        i.id === item.id
          ? { ...i, isRunning: false }
          : i
      )
    );

    // Update estimation in backend when timer is stopped
    const updateEstimation = async () => {
      try {
        const response = await fetch(`${API_URL}/items/${item.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            title: item.title,
            estimation: Math.ceil((item.remainingSeconds || 0) / 60), // Convert back to minutes
            priority: item.priority
          }),
        });

        if (!response.ok) throw new Error('Failed to update estimation');

        const updatedItem = await response.json();
        setItems(prevItems =>
          prevItems.map(i =>
            i.id === item.id ? { ...i, estimation: updatedItem.estimation } : i
          )
        );
      } catch (error) {
        console.error('Error updating estimation:', error);
      }
    };
    updateEstimation();
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleEstimationChange = (item: ExtendedItem, newEstimation: string) => {
    // Check if the input is in time format (MM:SS)
    const timeFormatRegex = /^(\d{1,2}):(\d{2})$/;
    const timeMatch = newEstimation.match(timeFormatRegex);

    // Check if the input is a valid number
    const numberRegex = /^\d*\.?\d*$/;
    const isNumber = numberRegex.test(newEstimation);

    let estimation: number;
    let format: 'points' | 'time';

    if (timeMatch) {
      // Convert time format to minutes
      const [mm, ss] = timeMatch.slice(1);
      const minutes = parseInt(mm);
      const seconds = parseInt(ss);

      // Validate time values
      if (minutes >= 0 && seconds >= 0 && seconds < 60) {
        estimation = minutes + (seconds / 60);
        format = 'time';
      } else {
        return; // Invalid time format
      }
    } else if (isNumber) {
      // Handle plain number input (points)
      estimation = parseFloat(newEstimation);
      format = 'points';
    } else {
      return; // Invalid input
    }

    if (!isNaN(estimation)) {
      setItems(prevItems =>
        prevItems.map(i =>
          i.id === item.id
            ? { ...i, estimation, estimationFormat: format, remainingSeconds: Math.floor(estimation * 60) }
            : i
        )
      );
    }
  };

  const formatEstimation = (estimation: number, format: 'points' | 'time') => {
    if (format === 'points') {
      return estimation.toString();
    }

    // Format as MM:SS
    const minutes = Math.floor(estimation);
    const seconds = Math.round((estimation - minutes) * 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const handleAddItem = async () => {
    if (!formData.title) return;

    const newItem: CreateItemDto = {
      title: formData.title,
      estimation: formData.estimation,
      estimationFormat: formData.estimationFormat,
      priority: formData.priority
    };

    try {
      const response = await fetch(`${API_URL}/items`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newItem),
      });

      if (!response.ok) throw new Error('Failed to create item');

      const createdItem = await response.json();
      const itemWithHighlight = { ...createdItem, highlight: true };
      setItems(prevItems => [...prevItems, itemWithHighlight]);
      setFormData({ title: '', estimation: 0, estimationFormat: 'points', priority: 0 });
      setIsModalOpen(false);
      setCurrentContext({ previousId: null, nextId: null });
    } catch (error) {
      console.error('Error creating item:', error);
    }
  };

  return (
    <div className="items-grid" onClick={handleOutsideClick}>
      {isLoading && (
        <div className="loading-overlay">
          <div className="loading-spinner"></div>
        </div>
      )}
      <div className="total-estimation">
        Total: {items.reduce((sum, item) => sum + item.estimation, 0)}
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
                  <>
                    {item.isEditingEstimation ? (
                      <div className="estimation-edit">
                        <input
                          type="text"
                          value={editingEstimationText}
                          onChange={(e) => setEditingEstimationText(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              handleEstimationSave(item);
                            } else if (e.key === 'Escape') {
                              handleEstimationCancel(item);
                            }
                          }}
                          placeholder="Enter points or time (MM:SS)"
                          autoFocus
                        />
                        <div className="edit-actions">
                          <button onClick={() => handleEstimationSave(item)}>Save</button>
                          <button onClick={() => handleEstimationCancel(item)}>Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <div className="timer-container">
                        <span
                          className={`estimation ${item.isRunning ? 'running' : ''} ${completedTimerId === item.id ? 'timer-complete' : ''}`}
                          onClick={() => handleEstimationEdit(item)}
                        >
                          {item.isRunning ? formatTime(item.remainingSeconds || 0) : formatEstimation(item.estimation, item.estimationFormat || 'points')}
                        </span>
                        {!item.isRunning ? (
                          <button className="timer-button" onClick={() => handleStartTimer(item)}>
                            <IoPlay />
                          </button>
                        ) : (
                          <button className="timer-button" onClick={() => handleStopTimer(item)}>
                            <IoStop />
                          </button>
                        )}
                      </div>
                    )}
                    <h3 onClick={() => handleTitleEdit(item)}>{item.title}</h3>
                  </>
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
