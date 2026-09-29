import React, { useState, useEffect, lazy, Suspense } from 'react'
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import Home from './pages/Home'
import Loader from './components/Loader'
import AIAssistant from './components/AIAssistant'
import { LocationProvider } from './context/LocationContext'
import { useAuth } from './context/AuthContext'

// Route-level code splitting: load secondary pages on-demand to shrink initial bundle
const Browse = lazy(() => import('./pages/Browse'))
const Sell = lazy(() => import('./pages/Sell'))
const ProductDetails = lazy(() => import('./pages/ProductDetails'))
const Login = lazy(() => import('./pages/Login'))
const Register = lazy(() => import('./pages/Register'))
const SellerDetails = lazy(() => import('./pages/SellerDetails'))
const Profile = lazy(() => import('./pages/Profile'))
const EditItem = lazy(() => import('./pages/EditItem'))
const AdminPanel = lazy(() => import('./pages/AdminPanel'))

function AdminRoute({ children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== 'admin') return <Navigate to="/" replace />;
  return children;
}

function App() {
  const [theme, setTheme] = useState(() => localStorage.getItem('bylot-theme') || 'light');

  useEffect(() => {
    document.body.className = theme === 'dark' ? 'dark-mode' : '';
    localStorage.setItem('bylot-theme', theme);
  }, [theme]);

  useEffect(() => {
    // Generate handshake key immediately without blocking render
    if (!localStorage.getItem('bylot-handshake')) {
      localStorage.setItem('bylot-handshake', Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2));
    }
  }, []);

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  return (
    <Router>
      <LocationProvider>
        <Layout theme={theme} toggleTheme={toggleTheme}>
          <Suspense fallback={<Loader />}>
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
              <Route path="/admin" element={<AdminRoute><AdminPanel /></AdminRoute>} />
            </Routes>
          </Suspense>
          <AIAssistant />
        </Layout>
      </LocationProvider>
    </Router>
  )
}

export default App
