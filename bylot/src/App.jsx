import { useState, useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Home from './pages/Home'
import Browse from './pages/Browse'
import Sell from './pages/Sell'
import ProductDetails from './pages/ProductDetails'
import Login from './pages/Login'
import Register from './pages/Register'
import SellerDetails from './pages/SellerDetails'
import Profile from './pages/Profile'
import EditItem from './pages/EditItem'
import AdminPanel from './pages/AdminPanel'
import Loader from './components/Loader'
import AIAssistant from './components/AIAssistant'
import { LocationProvider } from './context/LocationContext'

function App() {
  const [theme, setTheme] = useState(() => localStorage.getItem('bylot-theme') || 'light');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    document.body.className = theme === 'dark' ? 'dark-mode' : '';
    localStorage.setItem('bylot-theme', theme);
  }, [theme]);

  useEffect(() => {
    if (!localStorage.getItem('bylot-handshake')) {
      localStorage.setItem('bylot-handshake', Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2));
    }
    const timer = setTimeout(() => {
      setLoading(false);
    }, 2000);
    return () => clearTimeout(timer);
  }, []);

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  if (loading) {
    return <Loader />;
  }

  return (
    <Router basename={import.meta.env.BASE_URL.replace(/\/$/, '') || undefined}>
      <LocationProvider>
        <Layout theme={theme} toggleTheme={toggleTheme}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/browse" element={<Browse />} />
            <Route path="/sell" element={<Sell />} />
            <Route path="/product/:id" element={<ProductDetails />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/seller/:id" element={<SellerDetails />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/edit-item/:id" element={<EditItem />} />
            <Route path="/admin" element={<AdminPanel />} />
          </Routes>
          <AIAssistant />
        </Layout>
      </LocationProvider>
    </Router>
  )
}

export default App
