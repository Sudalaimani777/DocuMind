import { useState } from 'react';
import './App.css';

export default function App() {
  const [count, setCount] = useState(0);

  return (
    <div className="app-container">
      <h1>DocuMind</h1>
      <p className="subtitle">AI-Powered Document Processing & Intelligent Search</p>
      <div className="card">
        <button onClick={() => setCount((c) => c + 1)}>
          Count is {count}
        </button>
        <p>Client application initialized successfully.</p>
      </div>
    </div>
  );
}
