import { useState, useEffect, useRef } from 'react';
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

interface OrderItem {
  id: number;
  menuItem: MenuItem;
  quantity: number;
  price: number;
  notes?: string;
}

interface Order {
  id: number;
  orderNumber: number;
  status: string;
  tableNumber?: string;
  totalPrice: number;
  createdAt: string;
  items: OrderItem[];
  server: {
    id: number;
    username: string;
  };
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
  const [activeOrders, setActiveOrders] = useState<Order[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<'create' | 'orders'>('create');


  // WebSocket connection
  const backendUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
  const wsUrl = backendUrl.replace('http', 'ws');
  const { isConnected, lastMessage } = useWebSocket(wsUrl);

  // Fetch menu items and active orders on mount
  useEffect(() => {
    fetchMenuItems();
    fetchActiveOrders();
  }, []);

  // Handle WebSocket messages
  useEffect(() => {
    if (lastMessage) {
      console.log('WebSocket message received:', lastMessage);

      // Handle order:new - add to active orders if it's from this server
      if (lastMessage.type === 'order:new' && lastMessage.data?.serverId === user?.id) {
        setActiveOrders(prev => [lastMessage.data, ...prev]);
        showToast('New order created!', 'success');
      }

      // Handle order:served - remove from active orders
      if (lastMessage.type === 'order:served') {
        setActiveOrders(prev => prev.filter(order => order.id !== lastMessage.data?.id));
        if (lastMessage.data?.serverId === user?.id) {
          showToast('Order marked as served!', 'success');
        }
      }

      // Handle order:delete - remove from active orders
      if (lastMessage.type === 'order:delete') {
        setActiveOrders(prev => prev.filter(order => order.id !== lastMessage.data?.id));
        if (lastMessage.data?.serverId === user?.id) {
          showToast('Order deleted!', 'success');
        }
      }

      // Handle order:cancel - remove from active orders
      if (lastMessage.type === 'order:cancel') {
        setActiveOrders(prev => prev.filter(order => order.id !== lastMessage.data?.id));
      }
    }
  }, [lastMessage, user]);

  // --- Long Press Setup ---
  const longPressTimeoutRef = useRef<number | null>(null);
  const longPressIntervalRef = useRef<number | null>(null);

  // cleanup timers when component unmounts
  useEffect(() => {
    return () => {
      if (longPressTimeoutRef.current) clearTimeout(longPressTimeoutRef.current);
      if (longPressIntervalRef.current) clearInterval(longPressIntervalRef.current);
    };
  }, []);

  const startLongPress = (callback: () => void) => {
    // Clear any previous timers
    if (longPressTimeoutRef.current) clearTimeout(longPressTimeoutRef.current);
    if (longPressIntervalRef.current) clearInterval(longPressIntervalRef.current);

    // Wait 300 ms → then repeat every 100 ms
    longPressTimeoutRef.current = window.setTimeout(() => {
      callback(); // initial call after delay
      longPressIntervalRef.current = window.setInterval(() => {
        callback();
      }, 100);
    }, 300);
  };

  const stopLongPress = () => {
    if (longPressTimeoutRef.current) {
      clearTimeout(longPressTimeoutRef.current);
      longPressTimeoutRef.current = null;
    }
    if (longPressIntervalRef.current) {
      clearInterval(longPressIntervalRef.current);
      longPressIntervalRef.current = null;
    }
  };

  // --- Long Press Setup ---


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

  const fetchActiveOrders = async () => {
    setLoadingOrders(true);
    try {
      const response = await apiHelpers.orders.getActiveOrders();
      if (response.status === 'success') {
        setActiveOrders(response.data);
      }
    } catch (error) {
      console.error('Error fetching active orders:', error);
      showToast('Failed to load active orders', 'error');
    } finally {
      setLoadingOrders(false);
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
    setCart((prevCart) =>
      prevCart
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
        // Note: WebSocket will add the order to activeOrders automatically
      }
    } catch (error: any) {
      console.error('Error creating order:', error);
      showToast(error.response?.data?.message || 'Failed to create order', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const markOrderAsServed = async (orderId: number) => {
    try {
      const response = await apiHelpers.orders.markAsServed(orderId);
      if (response.status === 'success') {
        // WebSocket will handle removing from activeOrders
      }
    } catch (error: any) {
      console.error('Error marking order as served:', error);
      showToast(error.response?.data?.message || 'Failed to mark order as served', 'error');
    }
  };

  const deleteOrder = async (orderId: number) => {
    try {
      const response = await apiHelpers.orders.deleteOrder(orderId);
      if (response.status === 'success') {
        setDeleteConfirmId(null);
        // WebSocket will handle removing from activeOrders
      }
    } catch (error: any) {
      console.error('Error deleting order:', error);
      showToast(error.response?.data?.message || 'Failed to delete order', 'error');
    }
  };

  const getTimeSinceCreation = (createdAt: string) => {
    const now = new Date();
    const created = new Date(createdAt);
    const diffMs = now.getTime() - created.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'Just now';
    if (diffMins === 1) return '1 min ago';
    if (diffMins < 60) return `${diffMins} mins ago`;

    const diffHours = Math.floor(diffMins / 60);
    if (diffHours === 1) return '1 hour ago';
    return `${diffHours} hours ago`;
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

  // Header visibility logic
  const [showHeader, setShowHeader] = useState(true);
  const lastScrollY = useRef(0);

  useEffect(() => {
    const handleScroll = () => {
      const currentY = window.scrollY;

      // Only trigger if movement is noticeable
      if (Math.abs(currentY - lastScrollY.current) < 10) return;

      if (currentY > lastScrollY.current && currentY > 50) {
        // Scrolling down → hide header
        setShowHeader(false);
      } else if (currentY < 10) {
        // Only show header again when near top
        setShowHeader(true);
      }

      lastScrollY.current = currentY;
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 pb-[300px]">
      {/* Header */}
      <header className={`bg-white shadow-sm border-b border-slate-200 sticky top-0 z-10 transition-transform duration-300 ${showHeader ? 'translate-y-0' : '-translate-y-full'
        }`}>
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

      {/* Active Orders Section */}
      {viewMode === 'orders' && (
        <section className="max-w-7xl mx-auto px-2 sm:px-4 py-3">
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-3 sm:p-5">
            <h2 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
              🧾 Active Orders
              {activeOrders.length > 0 && (
                <span className="text-sm font-normal text-slate-600">
                  ({activeOrders.length})
                </span>
              )}
            </h2>

            {loadingOrders ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
              </div>
            ) : activeOrders.length === 0 ? (
              <div className="text-center py-8 text-slate-500">
                No active orders. Create a new order below.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">

                {activeOrders.map((order) => (
                  <div
                    key={order.id}
                    className="bg-slate-50 rounded-lg p-3 sm:p-4 border border-slate-200 hover:shadow-md transition"
                  >
                    {/* Order Header */}
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h3 className="text-lg font-bold text-slate-900">
                          Order #{order.orderNumber}
                        </h3>
                        <p className="text-sm text-slate-600">
                          {getTimeSinceCreation(order.createdAt)}
                        </p>
                        {order.tableNumber && (
                          <p className="text-sm text-slate-600">
                            Table: {order.tableNumber}
                          </p>
                        )}
                      </div>
                      <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-medium rounded">
                        {order.status}
                      </span>
                    </div>

                    {/* Order Items */}
                    <div className="mb-3 space-y-1 max-h-32 overflow-y-auto">
                      {order.items.map((item) => (
                        <div
                          key={item.id}
                          className="flex justify-between text-sm"
                        >
                          <span className="text-slate-700">
                            {item.quantity}x {item.menuItem.name}
                          </span>
                          <span className="text-slate-900 font-medium">
                            ${(item.price * item.quantity).toFixed(2)}
                          </span>
                        </div>
                      ))}
                    </div>

                    {/* Total Price */}
                    <div className="border-t border-slate-300 pt-2 mb-3">
                      <div className="flex justify-between items-center">
                        <span className="font-semibold text-slate-900">Total:</span>
                        <span className="text-lg font-bold text-blue-600">
                          ${order.totalPrice.toFixed(2)}
                        </span>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-2">
                      <button
                        onClick={() => markOrderAsServed(order.id)}
                        className="flex-1 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition flex items-center justify-center gap-2 font-medium"
                      >
                        <CheckCircle className="w-4 h-4" />
                        Mark Served
                      </button>
                      <button
                        onClick={() => setDeleteConfirmId(order.id)}
                        className="px-3 py-2 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg transition"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {/* New Order (Menu) Section */}
      {viewMode === 'create' && (
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
                          onMouseDown={() => startLongPress(() => updateQuantity(item.id, -1))}
                          onMouseUp={stopLongPress}
                          onMouseLeave={stopLongPress}
                          onTouchStart={() => startLongPress(() => updateQuantity(item.id, -1))}
                          onTouchEnd={stopLongPress}
                          onClick={() => updateQuantity(item.id, -1)}
                          className="p-2 bg-slate-100 hover:bg-slate-200 rounded-lg transition"
                        >
                          <Minus className="w-4 h-4" />
                        </button>
                        <span className="font-semibold text-lg">{cartItem.quantity}</span>
                        <button
                          onMouseDown={() => startLongPress(() => updateQuantity(item.id, 1))}
                          onMouseUp={stopLongPress}
                          onMouseLeave={stopLongPress}
                          onTouchStart={() => startLongPress(() => updateQuantity(item.id, 1))}
                          onTouchEnd={stopLongPress}
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
      )}

      {/* Bottom Bar — always visible */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 shadow z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex justify-center gap-4">
          {viewMode === 'create' ? (
            <>
              {/* Cancel Last Order */}
              <button
                onClick={() => setShowCancelModal(true)}
                disabled={submitting}
                className="px-6 py-3 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg transition font-medium disabled:opacity-50"
              >
                Cancel Last Order
              </button>

              {/* Toggle to Active Orders */}
              <button
                onClick={() => setViewMode('orders')}
                className="px-6 py-3 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-lg transition font-medium"
              >
                View Active Orders
              </button>
            </>
          ) : (
            <>
              {/* Toggle back to Create New Order */}
              <button
                onClick={() => setViewMode('create')}
                className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition font-medium"
              >
                Create New Order
              </button>
            </>
          )}
        </div>
      </div>

      {/* Cart View */}
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

      {/* Delete Order Confirmation Modal */}
      {deleteConfirmId !== null && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-xl font-bold text-slate-900 mb-2">Delete Order?</h3>
            <p className="text-slate-600 mb-6">
              Are you sure you want to delete this order? This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition"
              >
                Cancel
              </button>
              <button
                onClick={() => deleteOrder(deleteConfirmId)}
                className="flex-1 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition flex items-center justify-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                Delete
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
