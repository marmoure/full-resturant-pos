import { useState, useEffect } from 'react';
import { useAuth } from '../lib/AuthContext';
import { apiHelpers } from '../lib/api';
import { useWebSocket } from '../lib/useWebSocket';
import {
  ClipboardList,
  LogOut,
  Plus,
  Minus,
  Search,
  ShoppingCart,
  Trash2,
  CheckCircle,
  XCircle,
  Loader2,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface MenuItem {
  id: number;
  name: string;
  price: number;
  category: string;
  station: string;
  active: boolean;
}

interface CartItem {
  menuItem: MenuItem;
  quantity: number;
  notes?: string;
}

const ServerView = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [tableNumber, setTableNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [showCancelModal, setShowCancelModal] = useState(false);

  // WebSocket connection
  const backendUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
  const wsUrl = backendUrl.replace('http', 'ws');
  const { isConnected, lastMessage } = useWebSocket(wsUrl);

  // Fetch menu items on mount
  useEffect(() => {
    fetchMenuItems();
  }, []);

  // Handle WebSocket messages
  useEffect(() => {
    if (lastMessage) {
      console.log('WebSocket message received:', lastMessage);
      if (lastMessage.type === 'order:new') {
        showToast('New order received!', 'success');
      }
    }
  }, [lastMessage]);

  const fetchMenuItems = async () => {
    setLoading(true);
    try {
      const response = await apiHelpers.menu.getAll();
      if (response.status === 'success') {
        setMenuItems(response.data);
      }
    } catch (error) {
      console.error('Error fetching menu:', error);
      showToast('Failed to load menu items', 'error');
    } finally {
      setLoading(false);
    }
  };

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const addToCart = (menuItem: MenuItem) => {
    const existingItem = cart.find((item) => item.menuItem.id === menuItem.id);
    if (existingItem) {
      setCart(
        cart.map((item) =>
          item.menuItem.id === menuItem.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        )
      );
    } else {
      setCart([...cart, { menuItem, quantity: 1 }]);
    }
  };

  const updateQuantity = (menuItemId: number, delta: number) => {
    setCart(
      cart
        .map((item) =>
          item.menuItem.id === menuItemId
            ? { ...item, quantity: Math.max(0, item.quantity + delta) }
            : item
        )
        .filter((item) => item.quantity > 0)
    );
  };

  const removeFromCart = (menuItemId: number) => {
    setCart(cart.filter((item) => item.menuItem.id !== menuItemId));
  };

  const calculateTotal = () => {
    return cart.reduce((total, item) => total + item.menuItem.price * item.quantity, 0);
  };

  const submitOrder = async () => {
    if (cart.length === 0) {
      showToast('Cart is empty', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const items = cart.map((item) => ({
        menuItemId: item.menuItem.id,
        quantity: item.quantity,
        notes: item.notes,
      }));

      const response = await apiHelpers.orders.create(items, tableNumber || undefined);

      if (response.status === 'success') {
        showToast(`Order #${response.data.orderNumber} created successfully!`, 'success');
        setCart([]);
        setTableNumber('');
      }
    } catch (error: any) {
      console.error('Error creating order:', error);
      showToast(error.response?.data?.message || 'Failed to create order', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const cancelLastOrder = async () => {
    setSubmitting(true);
    try {
      const response = await apiHelpers.orders.cancelLast();
      if (response.status === 'success') {
        showToast(`Order #${response.data.orderNumber} cancelled`, 'success');
        setShowCancelModal(false);
      }
    } catch (error: any) {
      console.error('Error cancelling order:', error);
      showToast(error.response?.data?.message || 'Failed to cancel order', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // Filter menu items
  const filteredMenuItems = menuItems.filter((item) => {
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || item.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  // Get unique categories
  const categories = ['all', ...Array.from(new Set(menuItems.map((item) => item.category)))];

  return (
    <div className="min-h-screen bg-slate-50 pb-32">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <ClipboardList className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-slate-900">Order Management</h1>
                <p className="text-sm text-slate-600">Welcome, {user?.username}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 text-sm">
                <div
                  className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'
                    }`}
                />
                <span className="text-slate-600">
                  {isConnected ? 'Live' : 'Offline'}
                </span>
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
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Search and Filters */}
        <div className="mb-6 space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search menu items..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Category Filters */}
          <div className="flex gap-2 overflow-x-auto pb-2">
            {categories.map((category) => (
              <button
                key={category}
                onClick={() => setSelectedCategory(category)}
                className={`px-4 py-2 rounded-lg font-medium whitespace-nowrap transition ${selectedCategory === category
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-slate-700 hover:bg-slate-100'
                  }`}
              >
                {category.charAt(0).toUpperCase() + category.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Menu Items Grid */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredMenuItems.map((item) => {
              const cartItem = cart.find((ci) => ci.menuItem.id === item.id);
              return (
                <div
                  key={item.id}
                  className="bg-white rounded-lg shadow-sm border border-slate-200 p-4 hover:shadow-md transition"
                >
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-semibold text-slate-900">{item.name}</h3>
                    <span className="text-sm px-2 py-1 bg-slate-100 text-slate-600 rounded">
                      {item.station}
                    </span>
                  </div>
                  <p className="text-lg font-bold text-blue-600 mb-3">
                    ${item.price}
                  </p>
                  {cartItem ? (
                    <div className="flex items-center justify-between">
                      <button
                        onClick={() => updateQuantity(item.id, -1)}
                        className="p-2 bg-slate-100 hover:bg-slate-200 rounded-lg transition"
                      >
                        <Minus className="w-4 h-4" />
                      </button>
                      <span className="font-semibold text-lg">{cartItem.quantity}</span>
                      <button
                        onClick={() => updateQuantity(item.id, 1)}
                        className="p-2 bg-slate-100 hover:bg-slate-200 rounded-lg transition"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => addToCart(item)}
                      className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition flex items-center justify-center gap-2"
                    >
                      <Plus className="w-4 h-4" />
                      Add to Cart
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {filteredMenuItems.length === 0 && !loading && (
          <div className="text-center py-12 text-slate-500">
            No menu items found
          </div>
        )}
      </main>

      {/* Bottom Actions */}
      {cart.length === 0 && (
        // Show Cancel Last Order when the cart is empty
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 shadow z-20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex justify-center">
            <button
              onClick={() => setShowCancelModal(true)}
              disabled={submitting}
              className="px-6 py-3 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg transition font-medium disabled:opacity-50"
            >
              Cancel Last Order
            </button>
          </div>
        </div>
      )}

      {cart.length > 0 && (
        // Show full cart view when items are added
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 shadow-lg z-20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <ShoppingCart className="w-5 h-5 text-blue-600" />
                <span className="font-semibold text-slate-900">
                  Cart ({cart.reduce((sum, item) => sum + item.quantity, 0)} items)
                </span>
              </div>
              <button
                onClick={() => setCart([])}
                className="text-red-600 hover:text-red-700 text-sm font-medium"
              >
                Clear Cart
              </button>
            </div>

            {/* Cart Items */}
            <div className="max-h-32 overflow-y-auto mb-4 space-y-2">
              {cart.map((item) => (
                <div
                  key={item.menuItem.id}
                  className="flex items-center justify-between text-sm"
                >
                  <span className="text-slate-700">
                    {item.quantity}x {item.menuItem.name}
                  </span>
                  <div className="flex items-center gap-3">
                    <span className="font-semibold text-slate-900">
                      ${(item.menuItem.price * item.quantity).toFixed(2)}
                    </span>
                    <button
                      onClick={() => removeFromCart(item.menuItem.id)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Table Number Input */}
            <input
              type="text"
              placeholder="Table number (optional)"
              value={tableNumber}
              onChange={(e) => setTableNumber(e.target.value)}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg mb-4 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />

            {/* Submit Button Only */}
            <div className="flex justify-end">
              <button
                onClick={submitOrder}
                disabled={submitting}
                className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition font-medium flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>Submit Order - ${calculateTotal().toFixed(2)}</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}


      {/* Cancel Confirmation Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-xl font-bold text-slate-900 mb-2">Cancel Last Order?</h3>
            <p className="text-slate-600 mb-6">
              This will cancel your most recent order. This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowCancelModal(false)}
                disabled={submitting}
                className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition"
              >
                No, Keep It
              </button>
              <button
                onClick={cancelLastOrder}
                disabled={submitting}
                className="flex-1 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  'Yes, Cancel'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-24 right-4 z-50 animate-slide-up">
          <div
            className={`flex items-center gap-3 px-6 py-4 rounded-lg shadow-lg ${toast.type === 'success'
                ? 'bg-green-600 text-white'
                : 'bg-red-600 text-white'
              }`}
          >
            {toast.type === 'success' ? (
              <CheckCircle className="w-5 h-5" />
            ) : (
              <XCircle className="w-5 h-5" />
            )}
            <span className="font-medium">{toast.message}</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default ServerView;
