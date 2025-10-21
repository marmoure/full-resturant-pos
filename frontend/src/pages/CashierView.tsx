import { useState, useEffect } from 'react';
import { useAuth } from '../lib/AuthContext';
import { apiHelpers } from '../lib/api';
import { useWebSocket } from '../lib/useWebSocket';
import {
  DollarSign,
  LogOut,
  Clock,
  CheckCircle,
  XCircle,
  Loader2,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  User,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface MenuItem {
  id: number;
  name: string;
  price: number;
  category: string;
  station: string;
}

interface OrderItem {
  id: number;
  quantity: number;
  menuItem: MenuItem;
  notes?: string;
}

interface Order {
  id: number;
  orderNumber: number;
  tableNumber?: string;
  status: string;
  totalPrice: number;
  createdAt: string;
  items: OrderItem[];
  server: {
    username: string;
  };
}

const CashierView = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [checkingOut, setCheckingOut] = useState<number | null>(null);
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [expandedOrders, setExpandedOrders] = useState<Set<number>>(new Set());
  const [filterType, setFilterType] = useState<'all' | 'tables' | 'takeaway'>('all');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [highlightedOrders, setHighlightedOrders] = useState<Set<number>>(new Set());

  // WebSocket connection
  const backendUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
  const wsUrl = backendUrl.replace('http', 'ws');
  const { isConnected, lastMessage } = useWebSocket(wsUrl);

  // Fetch cashier orders on mount
  useEffect(() => {
    fetchCashierOrders();
  }, []);

  // Handle WebSocket messages for real-time updates
  useEffect(() => {
    if (lastMessage) {
      console.log('WebSocket message received:', lastMessage);

      switch (lastMessage.type) {
        case 'order:new':
          handleNewOrder(lastMessage.data);
          break;
        case 'order:update':
          handleOrderUpdate(lastMessage.data);
          break;
        case 'order:served':
          handleOrderUpdate(lastMessage.data);
          break;
        case 'order:cancel':
          handleOrderCancel(lastMessage.data);
          break;
        case 'order:completed':
          handleOrderCompleted(lastMessage.data);
          break;
        case 'order:delete':
          handleOrderCancel(lastMessage.data);
          break;
      }
    }
  }, [lastMessage]);

  const fetchCashierOrders = async () => {
    setLoading(true);
    try {
      const response = await apiHelpers.orders.getCashierOrders();
      if (response.status === 'success') {
        setOrders(response.data);
      }
    } catch (error) {
      console.error('Error fetching cashier orders:', error);
      showToast('Failed to load orders', 'error');
    } finally {
      setLoading(false);
    }
  };

  // WebSocket event handlers
  const handleNewOrder = (newOrder: Order) => {
    if (newOrder.status === 'OPEN' || newOrder.status === 'SERVED') {
      setOrders((prev) => [...prev, newOrder]);
      highlightOrder(newOrder.id);
      showToast(`New order #${newOrder.orderNumber} received!`, 'info');
    }
  };

  const handleOrderUpdate = (updatedOrder: Order) => {
    if (updatedOrder.status === 'OPEN' || updatedOrder.status === 'SERVED') {
      setOrders((prev) => {
        const exists = prev.some((o) => o.id === updatedOrder.id);
        if (exists) {
          return prev.map((o) => (o.id === updatedOrder.id ? updatedOrder : o));
        } else {
          return [...prev, updatedOrder];
        }
      });
      highlightOrder(updatedOrder.id);
      showToast(`Order #${updatedOrder.orderNumber} updated`, 'info');
    } else {
      // Remove if status changed to something else
      setOrders((prev) => prev.filter((o) => o.id !== updatedOrder.id));
    }
  };

  const handleOrderCancel = (cancelledOrder: Order) => {
    setOrders((prev) => prev.filter((o) => o.id !== cancelledOrder.id));
    showToast(`Order #${cancelledOrder.orderNumber} cancelled`, 'info');
  };

  const handleOrderCompleted = (completedOrder: Order) => {
    setOrders((prev) => prev.filter((o) => o.id !== completedOrder.id));
    showToast(`Order #${completedOrder.orderNumber} completed`, 'success');
  };

  // Highlight order with fade-in effect
  const highlightOrder = (orderId: number) => {
    setHighlightedOrders((prev) => new Set(prev).add(orderId));
    setTimeout(() => {
      setHighlightedOrders((prev) => {
        const newSet = new Set(prev);
        newSet.delete(orderId);
        return newSet;
      });
    }, 2000);
  };

  const showToast = (message: string, type: 'success' | 'error' | 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const toggleOrderDetails = (orderId: number) => {
    setExpandedOrders((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(orderId)) {
        newSet.delete(orderId);
      } else {
        newSet.add(orderId);
      }
      return newSet;
    });
  };

  const handleCheckoutClick = (order: Order) => {
    setSelectedOrder(order);
    setShowCheckoutModal(true);
  };

  const confirmCheckout = async () => {
    if (!selectedOrder) return;

    setCheckingOut(selectedOrder.id);
    try {
      const response = await apiHelpers.orders.checkoutOrder(selectedOrder.id);
      if (response.status === 'success') {
        showToast(`Order #${selectedOrder.orderNumber} completed successfully!`, 'success');
        setOrders((prev) => prev.filter((o) => o.id !== selectedOrder.id));
        setShowCheckoutModal(false);
        setSelectedOrder(null);
      }
    } catch (error: any) {
      console.error('Error checking out order:', error);
      showToast('Failed to complete checkout', 'error');
    } finally {
      setCheckingOut(null);
    }
  };

  // Calculate elapsed time since order creation
  const getElapsedTime = (createdAt: string): string => {
    const now = Date.now();
    const created = new Date(createdAt).getTime();
    const elapsed = Math.floor((now - created) / 1000); // seconds

    const minutes = Math.floor(elapsed / 60);
    const seconds = elapsed % 60;

    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  // Live timer component
  const LiveTimer = ({ createdAt }: { createdAt: string }) => {
    const [time, setTime] = useState(getElapsedTime(createdAt));

    useEffect(() => {
      const interval = setInterval(() => {
        setTime(getElapsedTime(createdAt));
      }, 1000);

      return () => clearInterval(interval);
    }, [createdAt]);

    return (
      <div className="flex items-center gap-1 text-sm text-slate-600">
        <Clock className="w-4 h-4" />
        {time}
      </div>
    );
  };

  // Get status badge color
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'OPEN':
        return 'bg-red-100 text-red-700';
      case 'SERVED':
        return 'bg-orange-100 text-orange-700';
      case 'COMPLETED':
        return 'bg-green-100 text-green-700';
      default:
        return 'bg-slate-100 text-slate-700';
    }
  };

  // Filter orders
  const filteredOrders = orders.filter((order) => {
    if (filterType === 'tables') return order.tableNumber;
    if (filterType === 'takeaway') return !order.tableNumber;
    return true;
  });

  // Calculate totals
  const totalOrders = filteredOrders.length;
  const totalRevenue = filteredOrders.reduce((sum, order) => sum + order.totalPrice, 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-slate-50 pb-24">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col gap-3">
            {/* Top row: Title + Logout */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-indigo-500 rounded-lg flex items-center justify-center shadow-lg">
                  <DollarSign className="w-7 h-7 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-slate-900">💰 Active Orders</h1>
                  <p className="text-sm text-slate-600">Welcome, {user?.username}</p>
                </div>
              </div>

              {/* Logout button */}
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={() => setFilterType('all')}
                className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all ${
                  filterType === 'all'
                    ? 'bg-gradient-to-r from-purple-500 to-indigo-500 text-white shadow-md'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                All ({orders.length})
              </button>
              <button
                onClick={() => setFilterType('tables')}
                className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all ${
                  filterType === 'tables'
                    ? 'bg-gradient-to-r from-purple-500 to-indigo-500 text-white shadow-md'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                Tables ({orders.filter((o) => o.tableNumber).length})
              </button>
              <button
                onClick={() => setFilterType('takeaway')}
                className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all ${
                  filterType === 'takeaway'
                    ? 'bg-gradient-to-r from-purple-500 to-indigo-500 text-white shadow-md'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                Takeaway ({orders.filter((o) => !o.tableNumber).length})
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm p-12 border border-slate-200 text-center">
            <DollarSign className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-slate-900 mb-2">No Active Orders</h2>
            <p className="text-slate-600">
              Orders ready for checkout will appear here in real-time.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredOrders.map((order) => {
              const isExpanded = expandedOrders.has(order.id);
              const isHighlighted = highlightedOrders.has(order.id);
              return (
                <div
                  key={order.id}
                  className={`bg-white rounded-xl shadow-md border-2 p-6 transition-all duration-300 ${
                    isHighlighted
                      ? 'border-purple-500 bg-purple-50 scale-[1.01]'
                      : 'border-slate-200 hover:shadow-lg'
                  }`}
                >
                  {/* Order Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-3xl font-black text-purple-600">
                          #{order.orderNumber}
                        </span>
                        {order.tableNumber ? (
                          <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-lg font-semibold text-sm">
                            Table {order.tableNumber}
                          </span>
                        ) : (
                          <span className="px-3 py-1 bg-amber-100 text-amber-700 rounded-lg font-semibold text-sm">
                            Takeaway
                          </span>
                        )}
                        <span className={`px-3 py-1 rounded-lg font-semibold text-sm ${getStatusColor(order.status)}`}>
                          {order.status}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-slate-600">
                        <div className="flex items-center gap-1">
                          <User className="w-4 h-4" />
                          {order.server.username}
                        </div>
                        <LiveTimer createdAt={order.createdAt} />
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-2">
                      <div className="text-2xl font-bold text-slate-900">
                        {order.totalPrice} DA
                      </div>
                      <button
                        onClick={() => handleCheckoutClick(order)}
                        disabled={checkingOut === order.id}
                        className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white rounded-lg transition font-semibold shadow-md disabled:opacity-50"
                      >
                        {checkingOut === order.id ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Processing...
                          </>
                        ) : (
                          <>
                            <CheckCircle className="w-4 h-4" />
                            Checkout
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* View Details Toggle */}
                  <button
                    onClick={() => toggleOrderDetails(order.id)}
                    className="w-full flex items-center justify-center gap-2 py-2 text-sm font-medium text-purple-600 hover:text-purple-700 transition"
                  >
                    {isExpanded ? (
                      <>
                        <ChevronUp className="w-4 h-4" />
                        Hide Details
                      </>
                    ) : (
                      <>
                        <ChevronDown className="w-4 h-4" />
                        View Details ({order.items.length} items)
                      </>
                    )}
                  </button>

                  {/* Order Items (Expandable) */}
                  {isExpanded && (
                    <div className="mt-4 pt-4 border-t border-slate-200 space-y-2">
                      {order.items.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-start justify-between p-3 bg-slate-50 rounded-lg"
                        >
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-lg font-bold text-purple-600">
                                {item.quantity}x
                              </span>
                              <span className="text-base font-semibold text-slate-900">
                                {item.menuItem.name}
                              </span>
                            </div>
                            {item.notes && (
                              <div className="flex items-start gap-2 mt-1 text-sm text-slate-600">
                                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                                {item.notes}
                              </div>
                            )}
                          </div>
                          <div className="text-base font-semibold text-slate-700">
                            {(item.menuItem.price * item.quantity)} DA
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Checkout Confirmation Modal */}
      {showCheckoutModal && selectedOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 max-w-md w-full shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-green-600" />
              </div>
              <h3 className="text-xl font-bold text-slate-900">Confirm Checkout</h3>
            </div>
            <div className="mb-6 space-y-2">
              <p className="text-slate-700">
                <span className="font-semibold">Order:</span> #{selectedOrder.orderNumber}
              </p>
              <p className="text-slate-700">
                <span className="font-semibold">Type:</span>{' '}
                {selectedOrder.tableNumber ? `Table ${selectedOrder.tableNumber}` : 'Takeaway'}
              </p>
              <p className="text-slate-700">
                <span className="font-semibold">Total:</span>{' '}
                <span className="text-2xl font-bold text-purple-600">
                  {selectedOrder.totalPrice} DA
                </span>
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowCheckoutModal(false);
                  setSelectedOrder(null);
                }}
                disabled={checkingOut !== null}
                className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition font-medium"
              >
                Cancel
              </button>
              <button
                onClick={confirmCheckout}
                disabled={checkingOut !== null}
                className="flex-1 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg transition font-medium flex items-center justify-center gap-2"
              >
                {checkingOut ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Processing...
                  </>
                ) : (
                  'Complete Checkout'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notifications */}
      {toast && (
        <div className="fixed bottom-28 right-4 z-50 animate-slide-up">
          <div
            className={`flex items-center gap-3 px-6 py-4 rounded-lg shadow-lg ${
              toast.type === 'success'
                ? 'bg-green-600 text-white'
                : toast.type === 'error'
                ? 'bg-red-600 text-white'
                : 'bg-blue-600 text-white'
            }`}
          >
            {toast.type === 'success' ? (
              <CheckCircle className="w-5 h-5" />
            ) : toast.type === 'error' ? (
              <XCircle className="w-5 h-5" />
            ) : (
              <AlertCircle className="w-5 h-5" />
            )}
            <span className="font-medium">{toast.message}</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default CashierView;
