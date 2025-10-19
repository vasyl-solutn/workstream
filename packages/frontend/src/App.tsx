import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import './App.css'
import { API_URL } from './config/api'
import Modal from './components/Modal'
import { IoAdd, IoTrashOutline, IoMove, IoPlay, IoStop } from 'react-icons/io5'
import { Item, CreateItemDto } from '@workstream/shared'
import { debounce } from './utils/debounce'
import { auth, googleProvider } from './firebase'
import { signInWithPopup, signOut, onAuthStateChanged, User } from 'firebase/auth'

// Timer Display component with its own tick
const TimerDisplay = ({ seconds, className }: { seconds: number, className: string }) => {
  const [displaySeconds, setDisplaySeconds] = useState(seconds);

  // Local timer effect that runs independently
  useEffect(() => {
    // Initialize with the current seconds
    setDisplaySeconds(seconds);

    // Only set up timer if we're displaying a positive number
    if (seconds <= 0) return;

    console.log(`Setting up timer display for ${seconds} seconds`);

    // Create a local timer that ticks every second
    const timer = setInterval(() => {
      setDisplaySeconds(prev => {
        // Decrement until we reach zero
        const newValue = Math.max(0, prev - 1);
        return newValue;
      });
    }, 1000);

    // Clean up the timer
    return () => clearInterval(timer);
  }, [seconds]); // Reset when seconds prop changes

  // Format the display seconds
  const minutes = Math.floor(displaySeconds / 60);
  const secs = displaySeconds % 60;

  return (
    <span className={className}>
      {displaySeconds <= 0 ? '0:00' : `${minutes}:${secs.toString().padStart(2, '0')}`}
    </span>
  );
};

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
  childrenCount?: number;
  lastFilteredAt?: string | null;
}

// Item component for rendering each item
const ItemComponent = ({
  item,
  index,
  selectedItem,
  handleTitleEdit,
  handleStartTimer,
  handleStopTimer,
  deleteItem,
  sortedItems,
  calculateEstimatedTime,
  completedTimerId,
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
  isAnyItemEditing,
  handleSetParent,
  allItems,
  debouncedSearchAutocomplete,
  autocompleteResults,
  isAutocompleteLoading
}: {
  item: ExtendedItem;
  index: number;
  selectedItem: string | null;
  handleTitleEdit: (item: ExtendedItem, focusEstimation: boolean) => void;
  handleStartTimer: (item: ExtendedItem) => void;
  handleStopTimer: (item: ExtendedItem) => void;
  deleteItem: (id: string | undefined) => Promise<void>;
  sortedItems: ExtendedItem[];
  calculateEstimatedTime: (items: ExtendedItem[], currentIndex: number) => string | null;
  completedTimerId: string | null;
  formatEstimation: (estimation: number, format: 'points' | 'time') => string;
  editingTitle: string;
  setEditingTitle: React.Dispatch<React.SetStateAction<string>>;
  editingEstimationText: string;
  setEditingEstimationText: React.Dispatch<React.SetStateAction<string>>;
  handleSaveNewItem: (item: ExtendedItem) => void;
  handleCancelNewItem: () => void;
  handleMove: (previousId: string | null, nextId: string | null) => Promise<void>;
  setSelectedItem: React.Dispatch<React.SetStateAction<string | null>>;
  handleAddBetween: (previousId: string | null, nextId: string | null) => void;
  isAnyItemEditing: boolean;
  handleSetParent: (itemId: string, parentId: string | null) => Promise<void>;
  allItems: ExtendedItem[];
  debouncedSearchAutocomplete: (searchTerm: unknown) => void;
  autocompleteResults: ExtendedItem[];
  isAutocompleteLoading: boolean;
}) => {
  // State for parent search
  const [parentSearchTerm, setParentSearchTerm] = React.useState('');
  const [showParentOptions, setShowParentOptions] = React.useState(false);

  // Note: We now use autocomplete results instead of filtered parent options

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
          {/* Main item title - on its own line */}
          {item.isEditing ? (
            <div className="title-edit">
              <textarea
                value={editingTitle}
                onChange={(e) => setEditingTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && e.metaKey) {
                    console.log("Cmd+Enter pressed, saving item:", item);
                    handleSaveNewItem(item);
                  } else if (e.key === 'Escape') {
                    console.log("Escape pressed, canceling item");
                    handleCancelNewItem();
                  }
                }}
                placeholder="Enter title"
                className="title-input"
                autoFocus
              />
              <div className="estimation-section">
                <input
                  type="text"
                  value={editingEstimationText}
                  onChange={(e) => setEditingEstimationText(e.target.value)}
                  placeholder="N or MM:SS"
                  className="estimation-input"
                  autoFocus={false}
                />
              </div>
              <div className="edit-actions">
                <button onClick={() => {
                  console.log("Save button clicked for item:", item);
                  handleSaveNewItem(item);
                }}>
                  Save
                </button>
                <button onClick={() => {
                  console.log("Cancel button clicked");
                  handleCancelNewItem();
                }}>
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div
              onClick={() => handleTitleEdit(item, false)}
              className={`item-title ${isAnyItemEditing && !item.isEditing && !item.isEditingEstimation ? "non-editable" : ""}`}
            >
              {item.title.split('\n').map((line, index) => (
                <React.Fragment key={index}>
                  {line}
                  {index < item.title.split('\n').length - 1 && <br />}
                </React.Fragment>
              ))}
              {item.parentId ? (
                <span
                  className="parent-title"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (item.id) {
                      setSelectedItem(item.id);
                      setShowParentOptions(true);
                      // Ensure the parent selection section is visible
                      const parentSelection = document.querySelector('.parent-selection') as HTMLElement;
                      if (parentSelection) {
                        parentSelection.style.display = 'block';
                      }
                    }
                  }}
                >
                  {allItems.find(p => p.id === item.parentId)?.title}
                </span>
              ) : (
                <span
                  className="parent-title placeholder"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (item.id) {
                      setSelectedItem(item.id);
                      setShowParentOptions(true);
                      // Ensure the parent selection section is visible
                      const parentSelection = document.querySelector('.parent-selection') as HTMLElement;
                      if (parentSelection) {
                        parentSelection.style.display = 'block';
                      }
                    }
                  }}
                >
                  + Set parent
                </span>
              )}
            </div>
          )}

          {/* Estimation and actions row - separate line below title */}
          {!item.isEditing && !item.isEditingEstimation && (
            <div className="item-meta-row">
              <div className="estimation-section">
                <span
                  className={`estimation ${item.isRunning ? 'running' : ''} ${completedTimerId === item.id ? 'timer-complete' : ''} ${isAnyItemEditing && !item.isEditing && !item.isEditingEstimation ? 'non-editable' : ''}`}
                  onClick={() => !item.isRunning && handleTitleEdit(item, true)}
                >
                  {item.isRunning
                    ? <TimerDisplay
                        seconds={item.remainingSeconds || 0}
                        className="timer-display"
                      />
                    : formatEstimation(item.estimation, item.estimationFormat || 'points')
                  }
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
                {item.childrenCount !== undefined && item.childrenCount > 0 && (
                  <span className="children-count" title={`${item.childrenCount} child items`}>
                    {item.childrenCount}
                  </span>
                )}
                {item.estimationFormat === 'time' && (
                  <span className="estimated-time">
                    by: {calculateEstimatedTime(sortedItems, index)}
                  </span>
                )}
              </div>

              <div className="item-actions">
                <button
                  className="icon-button move-button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (item.id) {
                      setSelectedItem(item.id);
                      setShowParentOptions(false); // Ensure parent dropdown is closed when moving
                    }
                  }}
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
          )}
          <div className="item-details" style={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
            {selectedItem === item.id && (
              <div className="parent-selection" style={{ width: '100%', padding: '10px 0', display: 'block' }}>
                <div className="parent-search" style={{ width: '100%', maxWidth: '400px' }}>
                  <input
                    type="text"
                    placeholder="Search parents..."
                    value={parentSearchTerm}
                    onChange={(e) => {
                      const value = e.target.value;
                      setParentSearchTerm(value);
                      debouncedSearchAutocomplete(value);
                    }}
                    onFocus={() => setShowParentOptions(true)}
                    onBlur={() => setTimeout(() => setShowParentOptions(false), 200)}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      marginBottom: '10px',
                      border: '1px solid #ccc',
                      borderRadius: '4px'
                    }}
                  />
                  <div
                    className={`parent-options ${showParentOptions ? 'expanded' : ''}`}
                    style={{
                      width: '100%',
                      maxHeight: showParentOptions ? '300px' : '0',
                      overflowY: 'auto',
                      position: 'absolute',
                      zIndex: 1000,
                      backgroundColor: 'white',
                      border: '1px solid #ccc',
                      borderRadius: '4px',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                      top: '100%',
                      left: 0,
                      right: 0,
                      marginTop: '4px',
                      display: showParentOptions ? 'block' : 'none'
                    }}
                  >
                    <button
                      className="parent-option"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (item.id) {
                          handleSetParent(item.id, null);
                        } else {
                          console.error('No item ID found');
                        }
                        // Hide options after selection
                        const options = e.currentTarget.parentElement as HTMLElement;
                        if (options) {
                          options.style.display = 'none';
                        }
                      }}
                      style={{
                        width: '100%',
                        textAlign: 'left',
                        padding: '8px 12px',
                        backgroundColor: !item.parentId ? '#f0f0f0' : 'transparent',
                        fontWeight: !item.parentId ? 'bold' : 'normal',
                        borderBottom: '1px solid #eee',
                        cursor: 'pointer'
                      }}
                    >
                      No Parent (Root Level)
                    </button>

                    {isAutocompleteLoading ? (
                      <p className="no-parents" style={{ padding: '8px 12px' }}>Loading...</p>
                    ) : autocompleteResults.length > 0 ? (
                      autocompleteResults
                        .filter(potentialParent => potentialParent.id !== item.id)
                        .map(potentialParent => (
                          <button
                            key={potentialParent.id}
                            className="parent-option"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              if (item.id && potentialParent.id) {
                                handleSetParent(item.id, potentialParent.id);
                              } else {
                                console.error('Missing item ID or parent ID');
                              }
                              // Hide options after selection
                              const options = e.currentTarget.parentElement as HTMLElement;
                              if (options) {
                                options.style.display = 'none';
                              }
                            }}
                            style={{
                              width: '100%',
                              textAlign: 'left',
                              padding: '8px 12px',
                              backgroundColor: item.parentId === potentialParent.id ? '#f0f0f0' : 'transparent',
                              fontWeight: item.parentId === potentialParent.id ? 'bold' : 'normal',
                              borderBottom: '1px solid #eee',
                              cursor: 'pointer'
                            }}
                          >
                            {potentialParent.title}
                            {potentialParent.childrenCount !== undefined && potentialParent.childrenCount > 0 && (
                              <span className="children-count" style={{ marginLeft: '8px' }}>
                                {potentialParent.childrenCount}
                              </span>
                            )}
                          </button>
                        ))
                    ) : parentSearchTerm.trim() ? (
                      <p className="no-parents" style={{ padding: '8px 12px' }}>No matching parents found</p>
                    ) : (
                      <p className="no-parents" style={{ padding: '8px 12px' }}>Type to search parents...</p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </article>
    </div>
  );
};

function App() {
  console.log("App component rendering");
  const renderCount = useRef(0);
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  useEffect(() => {
    renderCount.current++;
    console.log(`App rendered ${renderCount.current} times`);
  });

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => setCurrentUser(user));
    return () => unsub();
  }, []);

  const [items, setItems] = useState<ExtendedItem[]>([])
  const [allItems, setAllItems] = useState<ExtendedItem[]>([])
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
  const [currentParentFilters, setCurrentParentFilters] = useState<string[]>([]);
  const [parentFilterText, setParentFilterText] = useState('');
  const [parentDropdownOpen, setParentDropdownOpen] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);
  const [autocompleteResults, setAutocompleteResults] = useState<ExtendedItem[]>([]);
  const [isAutocompleteLoading, setIsAutocompleteLoading] = useState(false);

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

  // Timer effect - only run when needed
  useEffect(() => {
    console.log("Setting up main timer effect");

    // Create a stable interval that updates every second
    const timer = setInterval(() => {
      // Use the current items state to find running items
      setItems(prevItems => {
        // Check which items are running
        const runningItemsNow = prevItems.filter(item => item.isRunning && item.startedAt);
        console.log(`Timer tick - processing ${runningItemsNow.length} running items`);

        if (runningItemsNow.length === 0) {
          return prevItems; // No running items to update
        }

        let needsUpdate = false;
        const updatedItems = prevItems.map(item => {
          // Skip items that aren't running or don't have startedAt
          if (!item.isRunning || !item.startedAt || !item.id) {
            return item;
          }

          // Calculate current remaining time based on startedAt using the same timestamp
          const startTime = new Date(item.startedAt).getTime();
          const now = new Date().getTime();
          const elapsedSeconds = Math.floor((now - startTime) / 1000);
          const totalSeconds = Math.floor(item.estimation * 60);
          const remainingSeconds = Math.max(0, totalSeconds - elapsedSeconds);

          // Always update the remainingSeconds on each tick for running items
          needsUpdate = true;

          // Handle timer completion
          if (remainingSeconds === 0) {
            console.log(`Timer completed for item ${item.id}`);

            // Play sound
            if (audioRef.current) {
              audioRef.current.play().catch(error => console.log('Audio play failed:', error));
            }

            // Set completed item
            if (item.id) {
              setCompletedTimerId(item.id);
            }

            // Update backend
            if (item.id) {
              fetch(`${API_URL}/items/${item.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  title: item.title,
                  estimation: 0,
                  estimationFormat: 'time',
                  priority: item.priority,
                  startedAt: null
                }),
              })
              .then(response => response.ok ? response.json() : Promise.reject('Update failed'))
              .then(() => console.log('Timer completed, backend updated'))
              .catch(error => console.error('Error updating estimation:', error));
            }

            // Return completed item
            return {
              ...item,
              isRunning: false,
              remainingSeconds: 0,
              startedAt: null,
              estimation: 0
            };
          }

          // Return item with updated remaining time
          return { ...item, remainingSeconds };
        });

        // Return updated items if any timers needed updating
        return needsUpdate ? updatedItems : prevItems;
      });
    }, 1000);

    // Cleanup interval when component unmounts or dependencies change
    return () => {
      console.log("Cleaning up timer effect");
      clearInterval(timer);
    };
  }, []); // Empty dependency array to only set up timer once

  // Fetch main items list with parent filtering
  const fetchItems = async (parentIds: string[] = currentParentFilters) => {
    try {
      setIsLoading(true);

      // Create URL with parentIds query parameters
      let url = `${API_URL}/items`;

      // Add parent filter parameters
      if (parentIds.length > 0) {
        // Build query with multiple parentId parameters
        const params = new URLSearchParams();
        parentIds.forEach(id => params.append('parentId', id));
        url += `?${params.toString()}`;
      } else {
        // Explicitly add parentId=null when no filters are selected
        url += `?parentId=null`;
      }

      console.log('Fetching main items list with parent filtering:', url);
      const response = await fetch(url);

      if (!response.ok) throw new Error('Failed to fetch main items list');
      const data = await response.json();
      console.log('Received main items list from backend:', data.length, 'items');

      // Process items to set up timer states
      const processedItems = data.map((item: ExtendedItem) => {
        // Check if this item has a timer running (startedAt is set)
        if (item.startedAt) {
          console.log(`Item ${item.id} has startedAt=${item.startedAt}`);

          const startTime = new Date(item.startedAt).getTime();
          const now = new Date().getTime();
          const elapsedSeconds = Math.floor((now - startTime) / 1000);
          const totalSeconds = Math.floor(item.estimation * 60);
          const remainingSeconds = Math.max(0, totalSeconds - elapsedSeconds);

          console.log(`Item ${item.id}: elapsed=${elapsedSeconds}s, total=${totalSeconds}s, remaining=${remainingSeconds}s`);

          // If timer should be running
          if (remainingSeconds > 0) {
            console.log(`Item ${item.id} has a running timer with ${remainingSeconds}s remaining`);
            return {
              ...item,
              isRunning: true,
              remainingSeconds
            };
          } else {
            // Timer should have completed - will be reset on next render
            console.log(`Item ${item.id} timer should have completed`);
            return {
              ...item,
              isRunning: false,
              remainingSeconds: 0
            };
          }
        }
        return item;
      });

      console.log('Setting processed main items list:', processedItems.length, 'items');
      const runningItems = processedItems.filter((item: ExtendedItem) => item.isRunning);
      console.log(`Found ${runningItems.length} running timers:`, runningItems.map((i: ExtendedItem) => i.id));

      setItems(processedItems);

      // Fetch all items for the dropdown
      const allItemsResponse = await fetch(`${API_URL}/items`);
      if (allItemsResponse.ok) {
        const allItemsData = await allItemsResponse.json();
        setAllItems(allItemsData);
      }
    } catch (error) {
      console.error('Error fetching main items list:', error);
    } finally {
      setIsLoading(false);
    }
  };



  // Autocomplete function with debouncing
  const searchAutocomplete = async (searchTerm: string) => {
    try {
      setIsAutocompleteLoading(true);

      // If no query or less than 2 chars, fetch recent filters
      const url = !searchTerm || searchTerm.trim().length < 2
        ? `${API_URL}/parents-autocomplete?limit=15`
        : `${API_URL}/parents-autocomplete?q=${encodeURIComponent(searchTerm)}&limit=15`;

      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        setAutocompleteResults(data);
      } else {
        setAutocompleteResults([]);
      }
    } catch (error) {
      console.error('Error fetching autocomplete results:', error);
      setAutocompleteResults([]);
    } finally {
      setIsAutocompleteLoading(false);
    }
  };

  // Debounced autocomplete function
  const debouncedSearchAutocomplete = useCallback(
    debounce((searchTerm: unknown) => searchAutocomplete(searchTerm as string), 300),
    []
  );

  // When a parent is used as a filter, update its lastFilteredAt in the DB
  const updateLastFilteredAt = async (itemId: string) => {
    try {
      await fetch(`${API_URL}/items/${itemId}/last-filtered`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lastFilteredAt: new Date().toISOString() })
      });
    } catch {
      // Ignore errors for now
    }
  };

  // Toggle a parent ID in the filter
  const toggleParentFilter = (parentId: string | null) => {
    if (parentId === null) {
      // If "All Tasks" is clicked, clear all filters
      setCurrentParentFilters([]);
      fetchItems([]);
      return;
    }

    const newParentFilters = [...currentParentFilters];

    // Check if the ID is already in the filters
    const index = newParentFilters.indexOf(parentId);

    if (index > -1) {
      // If already selected, remove it
      newParentFilters.splice(index, 1);
    } else {
      // If not selected, add it
      newParentFilters.push(parentId);
      updateLastFilteredAt(parentId); // <-- update last used
    }

    setCurrentParentFilters(newParentFilters);
    fetchItems(newParentFilters);
  };

  // Handle setting a parent for an item (when moving)
  const handleSetParent = async (itemId: string, parentId: string | null) => {
    if (!itemId) return;

    setIsLoading(true);
    try {
      // Get the current item to preserve its other properties
      const currentItem = items.find(item => item.id === itemId);
      if (!currentItem) return;

      // Prepare the request body with all necessary fields
      const requestBody = {
        title: currentItem.title,
        estimation: currentItem.estimation,
        estimationFormat: currentItem.estimationFormat,
        priority: currentItem.priority,
        parentId: parentId
      };

      const response = await fetch(`${API_URL}/items/${itemId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to update parent: ${errorText}`);
      }

      // Update lastFilteredAt for the selected parent
      if (parentId) {
        await updateLastFilteredAt(parentId);
      }

      // Clear selected item
      setSelectedItem(null);

      // Refresh the items list to show updated order
      await fetchItems();

      // Highlight the moved item
      setItems(prevItems =>
        prevItems.map(item =>
          item.id === itemId ? { ...item, highlight: true } : item
        )
      );

      // Clear highlight after delay
      setTimeout(() => {
        setItems(prevItems =>
          prevItems.map(item =>
            item.id === itemId ? { ...item, highlight: false } : item
          )
        );
      }, 1500);
    } catch (error) {
      console.error('Error setting parent:', error);
      alert('Failed to set parent: ' + (error as Error).message);
    } finally {
      setIsLoading(false);
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
      // Prepare the request body
      const requestBody = {
        ...formData,
        previousId: currentContext.previousId,
        nextId: currentContext.nextId,
        parentId: currentParentFilters.length > 0 ? currentParentFilters[0] : null
      };

      const response = await fetch(`${API_URL}/items`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
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
    console.log("Initial items load triggered");
    fetchItems()
  }, [])  // Empty dependency array means this runs once on mount

  // Delete an item
  const deleteItem = async (id: string | undefined) => {
    if (!id) return;

    // Find the item to check if it has children
    const item = items.find(item => item.id === id);
    if (!item) return;

    // Only show confirmation if the item has children
    if (item.childrenCount && item.childrenCount > 0) {
      setItemToDelete(id);
      setShowDeleteConfirm(true);
      return;
    }

    // If no children, delete immediately
    await performDelete(id);
  };

  // Perform the actual deletion
  const performDelete = async (id: string) => {
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

  // Helper to generate a stable key for items to avoid unnecessary recalculations
  function getItemsKey(items: ExtendedItem[]): string {
    console.log('Calculating items key');

    // Check for any new items
    const hasNewItems = items.some(item => item.isNew);
    if (hasNewItems) {
      console.log('Found new items, forcing recalculation');
      // Force recalculation when we have new items
      return Date.now().toString();
    }

    return items
      .filter(item => !!item.id) // Only include stable items with IDs
      .map(item => {
        // Only include fields that affect sorting and rendering
        const { id, priority, isEditing, isEditingEstimation, isRunning } = item;
        return `${id}:${priority}:${isEditing}:${isEditingEstimation}:${isRunning}`;
      })
      .sort() // Sort to ensure stable order regardless of array order
      .join('|');
  }

  // Store the last items key to detect changes
  const lastItemsKeyRef = useRef<string>('');
  // Use a ref to maintain stable identity of sorted items
  const sortedItemsRef = useRef<ExtendedItem[]>([]);

  // More efficient memoization with explicit dependency tracking
  const sortedItems = useMemo(() => {
    const currentKey = getItemsKey(items);

    // Only recalculate if the key changed
    if (currentKey === lastItemsKeyRef.current && sortedItemsRef.current.length > 0) {
      console.log('Skipping sort recalculation - no relevant changes');
      return sortedItemsRef.current;
    }

    console.log('Recalculating sorted items - key changed');
    lastItemsKeyRef.current = currentKey;

    // Include all items - both stable ones with IDs and temporary new ones
    // Only exclude items that don't make sense to display
    const newItems = items.filter(item => item.isNew);
    console.log('New items found:', newItems.length, newItems);

    const itemsToSort = items.filter(item =>
      // Include items with IDs
      !!item.id ||
      // Include new items being created
      item.isNew
    );

    console.log('Sorting items:', itemsToSort.length);

    const newSortedItems = [...itemsToSort].sort((a, b) => a.priority - b.priority);
    sortedItemsRef.current = newSortedItems;

    return newSortedItems;
  }, [items]); // items is the dependency, but we do manual comparison

  // Note: Parent options are now handled by autocomplete

  const handleAddBetween = (previousId: string | null, nextId: string | null) => {
    console.log('handleAddBetween called with', { previousId, nextId });

    // Check if any item is currently being edited
    const isAnyItemEditing = items.some(item => item.isEditing || item.isEditingEstimation || item.isNew);

    // Don't allow adding a new item if another item is being edited
    if (isAnyItemEditing) {
      console.log('Cannot add item - another item is already being edited');
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

    console.log('Creating temp item with priority:', newPriority);
    console.log('Current parent filters:', currentParentFilters);

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
      isNew: true,
      parentId: currentParentFilters.length > 0 ? currentParentFilters[0] : null
    };

    console.log('Created temp item:', tempItem);

    // Add the item to the array
    setItems(prevItems => {
      const newItems = [...prevItems, tempItem];
      console.log('Items after adding temp item:', newItems.length);
      return newItems;
    });

    // Initialize editing state
    setEditingTitle('');
    setEditingEstimationText('');
  };

  const handleSaveNewItem = async (item: ExtendedItem) => {
    console.log('handleSaveNewItem called with item:', item);

    if (!editingTitle.trim()) {
      console.log('Title is empty, not saving');
      return;
    }

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
        nextId: item.nextId,
        parentId: currentParentFilters.length > 0 ? currentParentFilters[0] : null,
        // Preserve timer state if the item was running
        startedAt: item.isRunning ? item.startedAt : null
      };

      console.log('Sending item data to server:', itemData);

      let response;
      let updatedItem;

      if (item.isNew) {
        // This is a new item
        console.log('Creating new item');
        response = await fetch(`${API_URL}/items`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(itemData),
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error('Server error creating item:', errorText);
          throw new Error(`Failed to create item: ${errorText}`);
        }
        updatedItem = await response.json();
        console.log('Server returned new item:', updatedItem);
      } else {
        // This is an existing item being edited
        console.log('Updating existing item');
        response = await fetch(`${API_URL}/items/${item.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(itemData),
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error('Server error updating item:', errorText);
          throw new Error(`Failed to update item: ${errorText}`);
        }
        updatedItem = await response.json();
        console.log('Server returned updated item:', updatedItem);
      }

      // Update the item in the list
      setItems(prevItems => {
        console.log("handleSaveNewItem updating items");
        console.log("Temp item to replace:", item);
        console.log("Found items to update:", prevItems.filter(i => i.id === item.id || i.isNew).length);

        const updatedItems = prevItems.map(i =>
          (i.id === item.id || (i.isNew && !i.id)) // Match by ID or if it's a new item without ID
            ? {
                ...updatedItem,
                highlight: true,
                isEditing: false,
                isEditingEstimation: false,
                isNew: false,
                // Preserve timer state if the item was running
                isRunning: item.isRunning,
                remainingSeconds: item.remainingSeconds
              }
            : i
        );

        console.log("Items after update:", updatedItems.length);
        return updatedItems;
      });

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
      alert('Failed to save item: ' + (error as Error).message);
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

  const handleTitleEdit = (item: ExtendedItem, focusEstimation: boolean = false) => {
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

    // For running items, show remaining time instead of initial estimation
    if (item.isRunning && item.remainingSeconds !== undefined) {
      if (item.remainingSeconds <= 0) {
        setEditingEstimationText('0:00');
      } else {
        const minutes = Math.floor(item.remainingSeconds / 60);
        const seconds = item.remainingSeconds % 60;
        setEditingEstimationText(`${minutes}:${seconds.toString().padStart(2, '0')}`);
      }
    } else {
      setEditingEstimationText(formatEstimation(item.estimation, item.estimationFormat || 'points'));
    }

    // Set focus after a small delay to ensure the form is rendered
    setTimeout(() => {
      const input = document.querySelector(focusEstimation ? '.estimation-input' : '.title-input') as HTMLElement;
      if (input) {
        input.focus();
      }
    }, 0);
  };

  const handleStartTimer = (item: ExtendedItem) => {
    // Calculate total seconds for the timer
    const totalSeconds = Math.floor(item.estimation * 60);
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
      } catch (error) {
        console.error('Error updating start time:', error);
      }
    };

    // Update local state immediately
    setItems(prevItems =>
      prevItems.map(i =>
        i.id === item.id
          ? {
              ...i,
              isRunning: true,
              remainingSeconds: totalSeconds,
              startedAt: now
            }
          : i
      )
    );

    // Update the backend
    updateStartTime();
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

        // Update local state with the new estimation value
        setItems(prevItems =>
          prevItems.map(i =>
            i.id === item.id ? {
              ...i,
              isRunning: false,
              startedAt: null,
              estimation: newEstimation,
              remainingSeconds: remainingSeconds
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
          ? {
              ...i,
              isRunning: false,
              startedAt: null,
              estimation: newEstimation,
              remainingSeconds: remainingSeconds
            }
          : i
      )
    );

    updateEstimation();
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
      if (items[i] && items[i].estimationFormat === 'time') {
        if (items[i].isRunning) {
          const startTime = new Date(items[i].startedAt || '').getTime();
          const elapsedSeconds = Math.floor((now.getTime() - startTime) / 1000);
          const remainingSeconds = Math.max(0, items[i].estimation * 60 - elapsedSeconds);
          totalMinutes += remainingSeconds / 60;
        } else {
          totalMinutes += items[i].estimation;
        }
      }
    }

    // Add total minutes to current time
    const estimatedTime = new Date(now.getTime() + totalMinutes * 60000);
    return estimatedTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const isAnyItemEditing = items.some(item => item.isEditing || item.isEditingEstimation || item.isNew);

  // Fetch all items for parent dropdown/top filter
  const fetchAllItems = async () => {
    try {
      const response = await fetch(`${API_URL}/parents-autocomplete`);
      if (!response.ok) throw new Error('Failed to fetch parent dropdown items');
      const data = await response.json();
      setAllItems(data);
    } catch (error) {
      console.error('Error fetching parent dropdown items:', error);
    }
  };

  // Load all items when component mounts
  useEffect(() => {
    fetchAllItems();
  }, []);

  useEffect(() => {
    // Fetch recent parents immediately
    searchAutocomplete('');
  }, []);

  return (
    <div className="items-grid" onClick={handleOutsideClick}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '8px' }}>
        {currentUser ? (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span>{currentUser.email}</span>
            <button onClick={() => signOut(auth)}>Sign out</button>
          </div>
        ) : (
          <button onClick={() => signInWithPopup(auth, googleProvider)}>Sign in with Google</button>
        )}
      </div>
      {isLoading && (
        <div className="loading-overlay">
          <div className="loading-spinner"></div>
        </div>
      )}

      <div className="parent-filter">
        <div className="multiselect-container">
          <label htmlFor="parent-multiselect">Filter by parents:</label>
          <div className="selected-parents">
            {currentParentFilters.length > 0 ? (
              currentParentFilters.map(parentId => {
                const parent = allItems.find(item => item.id === parentId);
                return parent ? (
                  <div key={parentId} className="selected-parent-tag">
                    {parent.title}
                    {parent.childrenCount !== undefined && parent.childrenCount > 0 && (
                      <span className="children-count" style={{ marginLeft: '4px' }}>
                        {parent.childrenCount}
                      </span>
                    )}
                    <button
                      className="remove-parent"
                      onClick={() => toggleParentFilter(parentId)}
                    >
                      ×
                    </button>
                  </div>
                ) : null;
              })
            ) : (
              <div className="no-parents-selected">No parents selected (showing root items)</div>
            )}
          </div>
          {/* Custom dropdown for parent filter */}
          <div style={{ position: 'relative', width: '100%' }}>
            <input
              type="text"
              id="parent-multiselect"
              className="parent-filter-select"
              placeholder="Type to filter parents..."
              value={parentFilterText}
              onChange={e => {
                const value = e.target.value;
                setParentFilterText(value);
                setParentDropdownOpen(true);
                debouncedSearchAutocomplete(value);
              }}
              onFocus={() => setParentDropdownOpen(true)}
              onBlur={() => setTimeout(() => setParentDropdownOpen(false), 200)}
              autoComplete="off"
              style={{ width: '100%', marginBottom: 0, padding: '8px 12px', borderRadius: 8, border: '1px solid #e2e8f0' }}
            />
            {parentDropdownOpen && (
              <div style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                right: 0,
                background: 'white',
                border: '1px solid #e2e8f0',
                borderRadius: 8,
                zIndex: 1000,
                maxHeight: 300,
                overflowY: 'auto',
                boxShadow: '0 4px 8px rgba(0,0,0,0.08)'
              }}>
                {isAutocompleteLoading ? (
                  <div style={{ padding: '8px 12px', color: '#888' }}>Loading...</div>
                ) : autocompleteResults.length > 0 ? (
                  autocompleteResults
                    .filter(item => !currentParentFilters.includes(item.id || ''))
                    .map(item => {
                      // Build parent hierarchy, but limit to 3 levels
                      let parentChain = item.title;
                      let currentParent = allItems.find(p => p.id === item.parentId);
                      let depth = 0;
                      let hasMoreParents = false;
                      while (currentParent && depth < 2) {
                        parentChain = `${currentParent.title} → ${parentChain}`;
                        currentParent = allItems.find(p => p.id === currentParent?.parentId);
                        depth++;
                      }
                      if (currentParent) {
                        hasMoreParents = true;
                      }
                      if (hasMoreParents) {
                        parentChain = `… → ${parentChain}`;
                      }
                      return (
                        <div
                          key={item.id}
                          style={{ padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid #f1f5f9', background: 'white' }}
                          onMouseDown={() => {
                            toggleParentFilter(item.id!);
                            setParentFilterText('');
                            setParentDropdownOpen(false);
                          }}
                        >
                          {parentChain}
                          {item.childrenCount !== undefined && item.childrenCount > 0 && ` (${item.childrenCount})`}
                        </div>
                      );
                    })
                ) : parentFilterText.trim() ? (
                  <div style={{ padding: '8px 12px', color: '#888' }}>No matching parents</div>
                ) : (
                  <div style={{ padding: '8px 12px', color: '#888' }}>Type to search parents...</div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="total-estimation">
        <div className="total-items">
          Total Items: {items.length}
        </div>
        <div className="total-points">
          Total Points: {items
            .filter(item => item.estimationFormat === 'points')
            .reduce((sum, item) => sum + item.estimation, 0)}
        </div>
        <div className="total-time">
          Total Time: {formatEstimation(
            items
              .filter(item => item.estimationFormat === 'time')
              .reduce((sum, item) => {
                if (item.isRunning && item.startedAt) {
                  // For running items, calculate remaining time based on startedAt
                  const startTime = new Date(item.startedAt).getTime();
                  const now = new Date().getTime();
                  const elapsedSeconds = Math.floor((now - startTime) / 1000);
                  const totalSeconds = Math.floor(item.estimation * 60);
                  const remainingSeconds = Math.max(0, totalSeconds - elapsedSeconds);
                  return sum + (remainingSeconds / 60);
                }
                return sum + item.estimation;
              }, 0),
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

      {/* Log render information outside of JSX */}
      {(() => { console.log('Rendering sorted items:', sortedItems.length); return null; })()}

      {sortedItems.map((item, index) => (
        <ItemComponent
          key={item.id}
          item={item}
          index={index}
          selectedItem={selectedItem}
          handleTitleEdit={handleTitleEdit}
          handleStartTimer={handleStartTimer}
          handleStopTimer={handleStopTimer}
          deleteItem={deleteItem}
          sortedItems={sortedItems}
          calculateEstimatedTime={calculateEstimatedTime}
          completedTimerId={completedTimerId}
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
          handleSetParent={handleSetParent}
          allItems={allItems}
          debouncedSearchAutocomplete={debouncedSearchAutocomplete}
          autocompleteResults={autocompleteResults}
          isAutocompleteLoading={isAutocompleteLoading}
        />
      ))}

      {/* Last item add/move button */}
      {sortedItems.length > 0 && (
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
      )}

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

      {/* Delete Confirmation Modal */}
      <Modal isOpen={showDeleteConfirm} onClose={() => setShowDeleteConfirm(false)}>
        <div className="delete-confirm-modal">
          <h3>Confirm Deletion</h3>
          <p>Are you sure you want to delete this item? It has child items.</p>
          <div className="delete-confirm-actions">
            <button
              className="cancel-button"
              onClick={() => setShowDeleteConfirm(false)}
            >
              Cancel
            </button>
            <button
              className="delete-button"
              onClick={() => {
                if (itemToDelete) {
                  performDelete(itemToDelete);
                  setShowDeleteConfirm(false);
                  setItemToDelete(null);
                }
              }}
            >
              Delete
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

export default App
