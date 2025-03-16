import { useState, useEffect } from 'react'
import './App.css'
import { API_URL } from './config/api'

function App() {
  const [message, setMessage] = useState('Loading...')

  useEffect(() => {
    // Replace with your actual API URL in production
    fetch(`${API_URL}/your-endpoint`)
      .then(response => response.json())
      .then(data => setMessage(data.message))
      .catch(error => setMessage('Error connecting to API'))
  }, [])

  return (
    <div className="App">
      <header className="App-header">
        <h1>Workstream</h1>
        <p>{message}</p>
      </header>
    </div>
  )
}

export default App
