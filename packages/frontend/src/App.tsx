import React, { useState, useEffect, useRef } from 'react'
import './App.css'
import { API_URL } from './config/api'
import Modal from './components/Modal'
import { IoAdd, IoTrashOutline, IoMove, IoPlay, IoStop } from 'react-icons/io5'
import { Item, CreateItemDto } from '@workstream/shared'

// Force refreshing the Item type to include startedAt field
// The Item interface should have: startedAt?: string | null
interface ExtendedItem extends Item {
  highlight?: boolean;
  isEditing?: boolean;
  isEditingEstimation?: boolean;
  isRunning?: boolean;
  remainingSeconds?: number;
  previousId?: string | null;
  nextId?: string | null;
  isNew?: boolean;
  startedAt?: string | null; // This should be defined in the shared Item interface
}

// Item component for rendering each item
const ItemComponent = ({
  item,
  index,
  selectedItem,
  handleTitleEdit,
  handleEstimationEdit,
  handleEstimationSave,
  handleEstimationCancel,
  handleStartTimer,
  handleStopTimer,
  deleteItem,
  sortedItems,
  calculateEstimatedTime,
  completedTimerId,
  formatTime,
  formatEstimation,
  editingTitle,
  setEditingTitle,
  editingEstimationText,
  setEditingEstimationText,
  handleSaveNewItem,
  handleCancelNewItem,
  handleMove,
  setSelectedItem,
  handleAddBetween,
  isAnyItemEditing
}: {
  item: ExtendedItem;
  index: number;
  selectedItem: string | null;
  handleTitleEdit: (item: ExtendedItem) => void;
  handleEstimationEdit: (item: ExtendedItem) => void;
  handleEstimationSave: (item: ExtendedItem) => void;
  handleEstimationCancel: (item: ExtendedItem) => void;
  handleStartTimer: (item: ExtendedItem) => void;
  handleStopTimer: (item: ExtendedItem) => void;
  deleteItem: (id: string | undefined) => Promise<void>;
  sortedItems: ExtendedItem[];
  calculateEstimatedTime: (items: ExtendedItem[], currentIndex: number) => string | null;
  completedTimerId: string | null;
  formatTime: (seconds: number) => string;
  formatEstimation: (estimation: number, format: 'points' | 'time') => string;
  editingTitle: string;
  setEditingTitle: React.Dispatch<React.SetStateAction<string>>;
  editingEstimationText: string;
  setEditingEstimationText: React.Dispatch<React.SetStateAction<string>>;
  handleSaveNewItem: (item: ExtendedItem) => Promise<void>;
  handleCancelNewItem: () => void;
  handleMove: (previousId: string | null, nextId: string | null) => Promise<void>;
  setSelectedItem: React.Dispatch<React.SetStateAction<string | null>>;
  handleAddBetween: (previousId: string | null, nextId: string | null) => void;
  isAnyItemEditing: boolean;
}) => {
  return (
    <div className="item-wrapper">
      <div className="action-buttons">
        {!selectedItem ? (
          <button
            className="add-between-button"
            onClick={() => handleAddBetween(
              sortedItems[index - 1]?.id || null,
              item.id || null
            )}
            disabled={isAnyItemEditing}
          >
            <IoAdd />
          </button>
        ) : selectedItem !== item.id && selectedItem !== sortedItems[index - 1]?.id && (
          <button
            className="dot-button"
            onClick={() => handleMove(sortedItems[index - 1]?.id || null, item.id || null)}
            title="Paste here"
          >
            •
          </button>
        )}
      </div>
      <article className={`item-card ${selectedItem === item.id ? 'selected' : ''} ${item.highlight ? 'highlight' : ''}`}>
        <div className="item-content">
          <div className="item-header">
            {!item.isEditing && !item.isEditingEstimation && (
              <div className="timer-container" style={{ display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <span
                    className={`estimation ${item.isRunning ? 'running' : ''} ${completedTimerId === item.id ? 'timer-complete' : ''} ${isAnyItemEditing && !item.isEditing && !item.isEditingEstimation ? 'non-editable' : ''}`}
                    onClick={() => handleEstimationEdit(item)}
                  >
                    {item.isRunning ? formatTime(item.remainingSeconds || 0) : formatEstimation(item.estimation, item.estimationFormat || 'points')}
                  </span>
                  {item.estimationFormat === 'time' && (
                    !item.isRunning ? (
                      <button className="timer-button" onClick={() => handleStartTimer(item)}>
                        <IoPlay />
                      </button>
                    ) : (
                      <button className="timer-button" onClick={() => handleStopTimer(item)}>
                        <IoStop />
                      </button>
                    )
                  )}
                </div>
                {item.estimationFormat === 'time' && (
                  <div style={{ fontSize: '0.7em', color: '#666', marginTop: '2px', textAlign: 'left' }}>
                    by: {calculateEstimatedTime(sortedItems, index)}
                  </div>
                )}
              </div>
            )}
            {item.isEditingEstimation && (
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
                  placeholder="Estimation (number or MM:SS)"
                  className="estimation-input"
                  autoFocus
                />
                <div className="edit-actions">
                  <button onClick={() => handleEstimationSave(item)}>Save</button>
                  <button onClick={() => handleEstimationCancel(item)}>Cancel</button>
                </div>
              </div>
            )}
            {item.isEditing ? (
              <div className="title-edit">
                <div className="estimation-section">
                  <input
                    type="text"
                    value={editingEstimationText}
                    onChange={(e) => setEditingEstimationText(e.target.value)}
                    placeholder="Estimation (number or MM:SS)"
                    className="estimation-input"
                  />
                </div>
                <input
                  type="text"
                  value={editingTitle}
                  onChange={(e) => setEditingTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleSaveNewItem(item);
                    } else if (e.key === 'Escape') {
                      handleCancelNewItem();
                    }
                  }}
                  placeholder="Enter title"
                  autoFocus
                />
                <div className="edit-actions">
                  <button onClick={() => handleSaveNewItem(item)}>Save</button>
                  <button onClick={() => handleCancelNewItem()}>Cancel</button>
                </div>
              </div>
            ) : (
              <>
                <h3
                  onClick={() => handleTitleEdit(item)}
                  className={isAnyItemEditing && !item.isEditing && !item.isEditingEstimation ? "non-editable" : ""}
                >
                  {item.title}
                </h3>
              </>
            )}

            {!item.isEditing && (
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
            )}
          </div>
          <div className="item-details">
          </div>
        </div>
      </article>
    </div>
  );
};

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
          if (item.isRunning && item.startedAt) {
            // Calculate remaining time based on startedAt timestamp
            const startTime = new Date(item.startedAt).getTime();
            const now = new Date().getTime();
            const elapsedSeconds = Math.floor((now - startTime) / 1000);
            const totalSeconds = Math.floor(item.estimation * 60);
            const remainingSeconds = Math.max(0, totalSeconds - elapsedSeconds);

            if (remainingSeconds === 0) {
              if (audioRef.current) {
                audioRef.current.play().catch(error => console.log('Audio play failed:', error));
              }
              if (item.id) {
                setCompletedTimerId(item.id);
              }

              // Update estimation in backend and reset startedAt
              const updateEstimation = async () => {
                try {
                  const response = await fetch(`${API_URL}/items/${item.id}`, {
                    method: 'PUT',
                    headers: {
                      'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                      title: item.title,
                      estimation: 0,
                      estimationFormat: 'time',
                      priority: item.priority,
                      startedAt: null  // Reset startedAt when timer completes
                    }),
                  });

                  if (!response.ok) throw new Error('Failed to update estimation');

                  const updatedItem = await response.json();
                  setItems(prevItems =>
                    prevItems.map(i =>
                      i.id === item.id ? { ...i, isRunning: false, estimation: updatedItem.estimation, startedAt: null } : i
                    )
                  );
                } catch (error) {
                  console.error('Error updating estimation:', error);
                }
              };
              updateEstimation();
              return { ...item, isRunning: false, remainingSeconds: 0, startedAt: null };
            }

            return { ...item, remainingSeconds };
          }
          return item;
        })
      );
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Fetch all items and setup timer states
  const fetchItems = async () => {
    try {
      const response = await fetch(`${API_URL}/items`);
      if (!response.ok) throw new Error('Failed to fetch items');
      const data = await response.json();

      // Process items to set up timer states based on startedAt
      const processedItems = data.map((item: any) => {
        if (item.startedAt) {
          const startTime = new Date(item.startedAt).getTime();
          const now = new Date().getTime();
          const elapsedSeconds = Math.floor((now - startTime) / 1000);
          const totalSeconds = Math.floor(item.estimation * 60);
          const remainingSeconds = Math.max(0, totalSeconds - elapsedSeconds);

          // If timer should be running
          if (remainingSeconds > 0) {
            return {
              ...item,
              isRunning: true,
              remainingSeconds
            };
          } else {
            // Timer should have completed - will be reset on next render
            return {
              ...item,
              isRunning: false,
              remainingSeconds: 0
            };
          }
        }
        return item;
      });

      setItems(processedItems);
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
      await fetch(`${API_URL}/items/${selectedItem}/move`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          previousId,
          nextId
        }),
      });

      // Refresh the items list
      await fetchItems();

      // Highlight the moved item
      setItems(prevItems =>
        prevItems.map(item =>
          item.id === selectedItem ? { ...item, highlight: true } : item
        )
      );

      // Clear highlight after delay
      setTimeout(() => {
        setItems(prevItems =>
          prevItems.map(item =>
            item.id === selectedItem ? { ...item, highlight: false } : item
          )
        );
      }, 1500);

      setSelectedItem(null);
    } catch (error) {
      console.error('Error moving item:', error);
      alert('Failed to move item');
    } finally {
      setIsLoading(false);
    }
  };

  const sortedItems = [...items].sort((a, b) => a.priority - b.priority);

  const handleAddBetween = (previousId: string | null, nextId: string | null) => {
    // Check if any item is currently being edited
    const isAnyItemEditing = items.some(item => item.isEditing || item.isEditingEstimation || item.isNew);

    // Don't allow adding a new item if another item is being edited
    if (isAnyItemEditing) {
      return;
    }

    // Find the items to calculate the right priority
    const prevItem = previousId ? items.find(item => item.id === previousId) : null;
    const nextItem = nextId ? items.find(item => item.id === nextId) : null;

    // Calculate the priority to position correctly
    let newPriority = 0;

    if (prevItem && nextItem) {
      // Between two items
      newPriority = (prevItem.priority + nextItem.priority) / 2;
    } else if (prevItem) {
      // After the last item
      newPriority = prevItem.priority + 1;
    } else if (nextItem) {
      // Before the first item
      newPriority = nextItem.priority - 1;
    }

    // Create a temporary item
    const tempItem: ExtendedItem = {
      title: '',
      estimation: 0,
      estimationFormat: 'points',
      priority: newPriority,
      createdAt: new Date().toISOString(),
      isEditing: true,
      previousId,
      nextId,
      isNew: true
    };

    // Add the item to the array
    setItems(prevItems => [...prevItems, tempItem]);

    // Initialize editing state
    setEditingTitle('');
    setEditingEstimationText('');
  };

  const handleSaveNewItem = async (item: ExtendedItem) => {
    if (!editingTitle.trim()) return;

    setIsLoading(true);
    try {
      let estimation = 0;
      let estimationFormat: 'points' | 'time' = 'points';

      // Parse estimation value
      if (editingEstimationText) {
        if (editingEstimationText.includes(':')) {
          // Time format (MM:SS)
          const [minutes, seconds] = editingEstimationText.split(':');
          const mins = parseInt(minutes) || 0;
          const secs = parseInt(seconds || '0');

          if (secs >= 60) {
            alert('Seconds must be between 00 and 59');
            return;
          }

          estimation = mins + (secs / 60);
          estimationFormat = 'time';
        } else {
          // Points format
          const num = parseFloat(editingEstimationText);
          if (isNaN(num)) {
            alert('Invalid number format');
            return;
          }
          estimation = num;
          estimationFormat = 'points';
        }
      }

      const itemData = {
        title: editingTitle,
        estimation: estimation,
        estimationFormat: estimationFormat,
        priority: item.priority,
        previousId: item.previousId,
        nextId: item.nextId
      };

      let response;
      let updatedItem;

      if (item.isNew) {
        // This is a new item
        response = await fetch(`${API_URL}/items`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(itemData),
        });

        if (!response.ok) throw new Error('Failed to create item');
        updatedItem = await response.json();
      } else {
        // This is an existing item being edited
        response = await fetch(`${API_URL}/items/${item.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(itemData),
        });

        if (!response.ok) throw new Error('Failed to update item');
        updatedItem = await response.json();
      }

      // Update the item in the list
      setItems(prevItems =>
        prevItems.map(i =>
          i.id === item.id || i.isNew
            ? { ...updatedItem, highlight: true, isEditing: false, isEditingEstimation: false, isNew: false }
            : i
        )
      );

      // Clear highlight after a delay
      setTimeout(() => {
        setItems(prevItems =>
          prevItems.map(i =>
            i.id === updatedItem.id ? { ...i, highlight: false } : i
          )
        );
      }, 1500);

      // Close the form
      setEditingTitle('');
      setEditingEstimationText('');

    } catch (error) {
      console.error('Error saving item:', error);
      alert('Failed to save item');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancelNewItem = () => {
    // Clear form values
    setEditingTitle('');
    setEditingEstimationText('');

    // Remove temporary items and reset editing state for others
    setItems(prevItems =>
      prevItems
        // Filter out temporary new items that don't have an ID
        .filter(i => !i.isNew || i.id)
        // Reset editing state for remaining items
        .map(i => ({
          ...i,
          isEditing: false,
          isEditingEstimation: false,
          isNew: false
        }))
    );
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
    // Check if any other item is being edited
    const isAnyOtherItemEditing = items.some(i =>
      (i.id !== item.id) && (i.isEditing || i.isEditingEstimation || i.isNew)
    );

    // Don't allow editing if another item is already being edited
    if (isAnyOtherItemEditing) {
      return;
    }

    setItems(prevItems =>
      prevItems.map(i =>
        i.id === item.id ? { ...i, isEditing: true } : i
      )
    );
    setEditingTitle(item.title);
    setEditingEstimationText(formatEstimation(item.estimation, item.estimationFormat || 'points'));
  };

  const handleEstimationEdit = (item: ExtendedItem) => {
    // Check if any other item is being edited
    const isAnyOtherItemEditing = items.some(i =>
      (i.id !== item.id) && (i.isEditing || i.isEditingEstimation || i.isNew)
    );

    // Don't allow editing if another item is already being edited
    if (isAnyOtherItemEditing) {
      return;
    }

    setItems(prevItems =>
      prevItems.map(i =>
        i.id === item.id ? { ...i, isEditingEstimation: true } : i
      )
    );
    setEditingEstimationText(formatEstimation(item.estimation, item.estimationFormat || 'points'));
  };

  const handleEstimationSave = async (item: ExtendedItem) => {
    const value = editingEstimationText;
    let updated = false;

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
          updated = true;
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
          updated = true;
        } catch (error) {
          console.error('Error updating estimation:', error);
          alert('Failed to update estimation');
        } finally {
          setIsLoading(false);
        }
      }
    }

    // If update failed, still need to cancel editing mode
    if (!updated) {
      handleEstimationCancel(item);
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
    const now = new Date().toISOString();

    // Update backend with startedAt timestamp
    const updateStartTime = async () => {
      try {
        const response = await fetch(`${API_URL}/items/${item.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            title: item.title,
            estimation: item.estimation,
            estimationFormat: 'time',
            priority: item.priority,
            startedAt: now
          }),
        });

        if (!response.ok) throw new Error('Failed to update start time');

        // No need to update local state here, as the regular timer effect will handle it
      } catch (error) {
        console.error('Error updating start time:', error);
      }
    };

    updateStartTime();

    // Update local state immediately
    setItems(prevItems =>
      prevItems.map(i =>
        i.id === item.id
          ? {
              ...i,
              isRunning: true,
              remainingSeconds: Math.floor(item.estimation * 60),
              startedAt: now
            }
          : i
      )
    );
  };

  const handleStopTimer = (item: ExtendedItem) => {
    // Calculate remaining time based on elapsed time
    const startTime = item.startedAt ? new Date(item.startedAt).getTime() : 0;
    const now = new Date().getTime();
    const elapsedSeconds = Math.floor((now - startTime) / 1000);
    const totalSeconds = Math.floor(item.estimation * 60);
    const remainingSeconds = Math.max(0, totalSeconds - elapsedSeconds);
    const newEstimation = remainingSeconds / 60;

    // Update backend: save remaining time and reset startedAt
    const updateEstimation = async () => {
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
            priority: item.priority,
            startedAt: null // Reset startedAt when stopped
          }),
        });

        if (!response.ok) throw new Error('Failed to update estimation');

        await response.json();
        setItems(prevItems =>
          prevItems.map(i =>
            i.id === item.id ? {
              ...i,
              estimation: newEstimation,
              estimationFormat: 'time',
              startedAt: null
            } : i
          )
        );
      } catch (error) {
        console.error('Error updating estimation:', error);
      }
    };

    // Update local state immediately
    setItems(prevItems =>
      prevItems.map(i =>
        i.id === item.id
          ? { ...i, isRunning: false, startedAt: null }
          : i
      )
    );

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

  const calculateEstimatedTime = (items: ExtendedItem[], currentIndex: number) => {
    if (currentIndex < 0) return null;

    const now = new Date();
    let totalMinutes = 0;

    // Sum up all previous items' estimations plus current item
    for (let i = 0; i <= currentIndex; i++) {
      if (items[i].estimationFormat === 'time') {
        totalMinutes += items[i].estimation;
      }
    }

    // Add total minutes to current time
    const estimatedTime = new Date(now.getTime() + totalMinutes * 60000);
    return estimatedTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
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

  const isAnyItemEditing = items.some(item => item.isEditing || item.isEditingEstimation || item.isNew);

  return (
    <div className="items-grid" onClick={handleOutsideClick}>
      {isLoading && (
        <div className="loading-overlay">
          <div className="loading-spinner"></div>
        </div>
      )}
      <div className="total-estimation">
        <div className="total-points">
          Total Points: {items
            .filter(item => item.estimationFormat === 'points')
            .reduce((sum, item) => sum + item.estimation, 0)}
        </div>
        <div className="total-time">
          Total Time: {formatEstimation(
            items
              .filter(item => item.estimationFormat === 'time')
              .reduce((sum, item) => sum + item.estimation, 0),
            'time'
          )}
        </div>
      </div>

      {/* First item add button (only show if there are no items or before first item) */}
      {sortedItems.length === 0 && (
        <div className="item-wrapper">
          <button
            className="add-between-button"
            onClick={() => handleAddBetween(null, null)}
            disabled={isAnyItemEditing}
          >
            <IoAdd />
          </button>
        </div>
      )}

      {sortedItems.map((item, index) => (
        <ItemComponent
          key={item.id}
          item={item}
          index={index}
          selectedItem={selectedItem}
          handleTitleEdit={handleTitleEdit}
          handleEstimationEdit={handleEstimationEdit}
          handleEstimationSave={handleEstimationSave}
          handleEstimationCancel={handleEstimationCancel}
          handleStartTimer={handleStartTimer}
          handleStopTimer={handleStopTimer}
          deleteItem={deleteItem}
          sortedItems={sortedItems}
          calculateEstimatedTime={calculateEstimatedTime}
          completedTimerId={completedTimerId}
          formatTime={formatTime}
          formatEstimation={formatEstimation}
          editingTitle={editingTitle}
          setEditingTitle={setEditingTitle}
          editingEstimationText={editingEstimationText}
          setEditingEstimationText={setEditingEstimationText}
          handleSaveNewItem={handleSaveNewItem}
          handleCancelNewItem={handleCancelNewItem}
          handleMove={handleMove}
          setSelectedItem={setSelectedItem}
          handleAddBetween={handleAddBetween}
          isAnyItemEditing={isAnyItemEditing}
        />
      ))}

      {/* Last item add/move button */}
      <div className="item-wrapper">
        {selectedItem ? (
          <button
            className="dot-button"
            onClick={() => handleMove(sortedItems[sortedItems.length - 1]?.id || null, null)}
            title="Paste at the end"
          >
            •
          </button>
        ) : (
          <button
            className="add-between-button"
            onClick={() => handleAddBetween(
              sortedItems[sortedItems.length - 1]?.id || null,
              null
            )}
            disabled={isAnyItemEditing}
          >
            <IoAdd />
          </button>
        )}
      </div>

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
