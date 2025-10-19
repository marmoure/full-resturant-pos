import { useAuth } from '../lib/AuthContext';
import { DollarSign, LogOut } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const CashierView = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white shadow-sm border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                <DollarSign className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-slate-900">Cashier View</h1>
                <p className="text-sm text-slate-600">Welcome, {user?.username}</p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition"
            >
              <LogOut className="w-4 h-4" />
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-xl shadow-sm p-8 border border-slate-200 text-center">
          <DollarSign className="w-16 h-16 text-purple-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Checkout Management</h2>
          <p className="text-slate-600 mb-6">
            Process payments and manage checkouts. Coming soon!
          </p>
          <div className="inline-block px-4 py-2 bg-purple-100 text-purple-700 rounded-lg text-sm font-medium">
            Phase 3: Checkout System
          </div>
        </div>
      </main>
    </div>
  );
};

export default CashierView;
