import { useAuth } from '../lib/AuthContext';
import { Crown, LogOut, BarChart3, Users, DollarSign, TrendingUp } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const OwnerDashboard = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center">
                <Crown className="w-6 h-6 text-yellow-600" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-slate-900">Owner Dashboard</h1>
                <p className="text-sm text-slate-600">Welcome back, {user?.username}</p>
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

      {/* Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {/* Stats Cards */}
          <div className="bg-white rounded-xl shadow-sm p-6 border border-slate-200">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-slate-600">Total Revenue</p>
              <DollarSign className="w-5 h-5 text-green-600" />
            </div>
            <p className="text-3xl font-bold text-slate-900">$12,450</p>
            <p className="text-sm text-green-600 mt-1">+12% from last week</p>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6 border border-slate-200">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-slate-600">Orders Today</p>
              <BarChart3 className="w-5 h-5 text-blue-600" />
            </div>
            <p className="text-3xl font-bold text-slate-900">142</p>
            <p className="text-sm text-blue-600 mt-1">+8% from yesterday</p>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6 border border-slate-200">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-slate-600">Active Staff</p>
              <Users className="w-5 h-5 text-purple-600" />
            </div>
            <p className="text-3xl font-bold text-slate-900">8</p>
            <p className="text-sm text-slate-600 mt-1">Currently working</p>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6 border border-slate-200">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-slate-600">Avg Order Value</p>
              <TrendingUp className="w-5 h-5 text-orange-600" />
            </div>
            <p className="text-3xl font-bold text-slate-900">$87.68</p>
            <p className="text-sm text-orange-600 mt-1">+5% from last week</p>
          </div>
        </div>

        {/* Coming Soon Section */}
        <div className="bg-white rounded-xl shadow-sm p-8 border border-slate-200">
          <h2 className="text-xl font-bold text-slate-900 mb-4">Coming in Phase 3</h2>
          <ul className="space-y-3 text-slate-700">
            <li className="flex items-center gap-2">
              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
              Real-time analytics and reporting
            </li>
            <li className="flex items-center gap-2">
              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
              Staff management and scheduling
            </li>
            <li className="flex items-center gap-2">
              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
              Menu and inventory management
            </li>
            <li className="flex items-center gap-2">
              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
              Financial reports and insights
            </li>
          </ul>
        </div>
      </main>
    </div>
  );
};

export default OwnerDashboard;
