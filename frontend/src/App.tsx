import { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './lib/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import OwnerDashboard from './pages/OwnerDashboard';
import ServerView from './pages/ServerView';
import CashierView from './pages/CashierView';
import GrillView from './pages/GrillView';
import KitchenView from './pages/KitchenView';

// Component to handle role-based redirects after login
const RoleBasedRedirect = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      // Redirect based on user role
      switch (user.role) {
        case 'OWNER':
          navigate('/owner', { replace: true });
          break;
        case 'SERVER':
          navigate('/server', { replace: true });
          break;
        case 'CASHIER':
          navigate('/cashier', { replace: true });
          break;
        case 'GRILL_COOK':
          navigate('/grill', { replace: true });
          break;
        case 'KITCHEN_STAFF':
          navigate('/kitchen', { replace: true });
          break;
        default:
          navigate('/login', { replace: true });
      }
    }
  }, [user, navigate]);

  return null;
};

function App() {
  return (
    <Router>
      <AuthProvider>
        <RoleBasedRedirect />
        <Routes>
          {/* Public Routes */}
          <Route path="/login" element={<Login />} />

          {/* Protected Routes - Owner */}
          <Route
            path="/owner"
            element={
              <ProtectedRoute allowedRoles={['OWNER']}>
                <OwnerDashboard />
              </ProtectedRoute>
            }
          />

          {/* Protected Routes - Server */}
          <Route
            path="/server"
            element={
              <ProtectedRoute allowedRoles={['SERVER']}>
                <ServerView />
              </ProtectedRoute>
            }
          />

          {/* Protected Routes - Cashier */}
          <Route
            path="/cashier"
            element={
              <ProtectedRoute allowedRoles={['CASHIER']}>
                <CashierView />
              </ProtectedRoute>
            }
          />

          {/* Protected Routes - Grill Cook */}
          <Route
            path="/grill"
            element={
              <ProtectedRoute allowedRoles={['GRILL_COOK']}>
                <GrillView />
              </ProtectedRoute>
            }
          />

          {/* Protected Routes - Kitchen Staff */}
          <Route
            path="/kitchen"
            element={
              <ProtectedRoute allowedRoles={['KITCHEN_STAFF']}>
                <KitchenView />
              </ProtectedRoute>
            }
          />

          {/* Default redirect to login */}
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </AuthProvider>
    </Router>
  );
}

export default App;
