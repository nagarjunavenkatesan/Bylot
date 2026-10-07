import React, { useState, useEffect, lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Home from './pages/Home';
import Loader from './components/Loader';
import AIAssistant from './components/AIAssistant';
import { LocationProvider } from './context/LocationContext';
import { useAuth } from './context/AuthContext';

// Route-level code splitting
const Browse = lazy(() => import('./pages/Browse'));
const Category = lazy(() => import('./pages/Category'));
const Location = lazy(() => import('./pages/Location'));
const ProductDetails = lazy(() => import('./pages/ProductDetails'));
const SellerDetails = lazy(() => import('./pages/SellerDetails'));
const About = lazy(() => import('./pages/About'));
const Contact = lazy(() => import('./pages/Contact'));
const Terms = lazy(() => import('./pages/Terms'));
const Privacy = lazy(() => import('./pages/Privacy'));
const FAQ = lazy(() => import('./pages/FAQ'));
const NotFound = lazy(() => import('./pages/NotFound'));

const Sell = lazy(() => import('./pages/Sell'));
const Login = lazy(() => import('./pages/Login'));
const Profile = lazy(() => import('./pages/Profile'));
const EditItem = lazy(() => import('./pages/EditItem'));
const AdminPanel = lazy(() => import('./pages/AdminPanel'));
const SellerOrders = lazy(() => import('./pages/SellerOrders'));

function AdminRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <Loader />;
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

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  return (
    <Router>
      <LocationProvider>
        <Layout theme={theme} toggleTheme={toggleTheme}>
          <Suspense fallback={<Loader />}>
            <Routes>
              {/* Core Indexable Public Routes */}
              <Route path="/" element={<Home />} />
              <Route path="/browse" element={<Browse />} />
              <Route path="/category/:slug" element={<Category />} />
              <Route path="/location/:city" element={<Location />} />
              <Route path="/location/:city/:category" element={<Location />} />
              <Route path="/product/:id" element={<ProductDetails />} />
              <Route path="/seller/:id" element={<SellerDetails />} />
              <Route path="/about" element={<About />} />
              <Route path="/contact" element={<Contact />} />
              <Route path="/terms" element={<Terms />} />
              <Route path="/privacy" element={<Privacy />} />
              <Route path="/faq" element={<FAQ />} />

              {/* Auth & Member Routes */}
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Navigate to="/login" replace />} />
              <Route path="/reset-password" element={<Navigate to="/login" replace />} />
              <Route path="/verify-email" element={<Navigate to="/login" replace />} />
              <Route path="/sell" element={<Sell />} />
              <Route path="/seller/orders" element={<SellerOrders />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/edit-item/:id" element={<EditItem />} />
              <Route path="/admin" element={<AdminRoute><AdminPanel /></AdminRoute>} />

              {/* 404 Catch-All Route */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
          <AIAssistant />
        </Layout>
      </LocationProvider>
    </Router>
  );
}

export default App;
