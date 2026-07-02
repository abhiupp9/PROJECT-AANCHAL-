import React, { useState } from 'react';
import Auth from './components/Auth';
import Dashboard from './components/Dashboard';

export default function App() {
  const [user, setUser] = useState(() => {
    // Check if session exists locally
    return localStorage.getItem('aanchal_session_user') || null;
  });

  const handleSignIn = (username) => {
    localStorage.setItem('aanchal_session_user', username);
    setUser(username);
  };

  const handleSignOut = () => {
    localStorage.removeItem('aanchal_session_user');
    setUser(null);
  };

  return (
    <div className="app-root">
      {user ? (
        <Dashboard username={user} onSignOut={handleSignOut} />
      ) : (
        <Auth onSignIn={handleSignIn} />
      )}
    </div>
  );
}
