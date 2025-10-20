import { useState, useEffect } from 'react';
import { useAuth } from '../lib/AuthContext';
import { apiHelpers } from '../lib/api';
import { useWebSocket } from '../lib/useWebSocket';
import {
  Flame,
  LogOut,
  Clock,
  Trash2,
  CheckCircle,
  XCircle,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import newOrderSrc from '../sounds/new-order.mp3';

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
  createdAt: string;
  items: OrderItem[];
  server: {
    username: string;
  };
}

const newOrderSound = new Audio(newOrderSrc);

const GrillView = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [showClearModal, setShowClearModal] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [highlightedOrders, setHighlightedOrders] = useState<Set<number>>(new Set());
  const [completedOrders, setCompletedOrders] = useState<Set<number>>(() => {
    try {
      const stored = localStorage.getItem('grillCompletedOrders');
      return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch {
      return new Set();
    }
  });
  const [showArchive, setShowArchive] = useState(false);
  const [fadingOrders, setFadingOrders] = useState<Set<number>>(new Set());



  // WebSocket connection
  const backendUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
  const wsUrl = backendUrl.replace('http', 'ws');
  const { isConnected, lastMessage } = useWebSocket(wsUrl);

  // Fetch grill orders on mount
  useEffect(() => {
    fetchGrillOrders();
    newOrderSound.load()
  }, []);


  // Save completed orders to localStorage
  useEffect(() => {
    localStorage.setItem('grillCompletedOrders', JSON.stringify([...completedOrders]));
  }, [completedOrders]);

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
        case 'order:cancel':
          handleOrderCancel(lastMessage.data);
          break;
        case 'grill:clear':
          handleGrillClear();
          break;
      }
    }
  }, [lastMessage]);

  const fetchGrillOrders = async () => {
    setLoading(true);
    try {
      const response = await apiHelpers.orders.getGrillOrders();
      if (response.status === 'success') {
        setOrders(response.data);
      }
    } catch (error) {
      console.error('Error fetching grill orders:', error);
      showToast('Failed to load grill orders', 'error');
    } finally {
      setLoading(false);
    }
  };

  // WebSocket event handlers
  const handleNewOrder = (newOrder: Order) => {
    // Check if order has grill items
    const hasGrillItems = newOrder.items?.some((item: OrderItem) => item.menuItem.station === 'grill');
    if (hasGrillItems && newOrder.id) {
      setOrders((prev) => [...prev, newOrder]);
      highlightOrder(newOrder.id);
      showToast(`New order #${newOrder.orderNumber} received!`, 'info');
      newOrderSound.play().catch((e) => console.error(e));
    }
  };

  const handleOrderUpdate = (updatedOrder: Order) => {
    const hasGrillItems = updatedOrder.items?.some((item: OrderItem) => item.menuItem.station === 'grill');

    if (hasGrillItems) {
      setOrders((prev) => {
        const exists = prev.some((o) => o.id === updatedOrder.id);
        if (exists) {
          // Update existing order
          return prev.map((o) => (o.id === updatedOrder.id ? updatedOrder : o));
        } else {
          // Add new order
          return [...prev, updatedOrder];
        }
      });
      if (updatedOrder.id) {
        highlightOrder(updatedOrder.id);
      }
      showToast(`Order #${updatedOrder.orderNumber} updated`, 'info');
    } else {
      // Remove order if it no longer has grill items
      setOrders((prev) => prev.filter((o) => o.id !== updatedOrder.id));
    }
  };

  const handleOrderCancel = (cancelledOrder: Order) => {
    setOrders((prev) => prev.filter((o) => o.id !== cancelledOrder.id));
    showToast(`Order #${cancelledOrder.orderNumber} cancelled`, 'info');
  };

  const handleGrillClear = () => {
    setOrders([]);
    showToast('All grill orders cleared', 'success');
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

  const clearAllOrders = async () => {
    setClearing(true);
    try {
      const response = await apiHelpers.orders.clearGrillOrders();
      if (response.status === 'success') {
        setOrders([]);
        showToast(`Cleared ${response.data.cleared} orders`, 'success');
        setShowClearModal(false);
      }
    } catch (error: any) {
      console.error('Error clearing orders:', error);
      showToast(error.response?.data?.message || 'Failed to clear orders', 'error');
    } finally {
      setClearing(false);
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

    // Get color based on elapsed time
    const getTimeColor = () => {
      const elapsed = Math.floor((Date.now() - new Date(createdAt).getTime()) / 1000);
      if (elapsed < 300) return 'text-green-600'; // < 5 min
      if (elapsed < 600) return 'text-yellow-600'; // < 10 min
      return 'text-red-600'; // > 10 min
    };

    return (
      <div className={`flex items-center gap-1 font-mono text-lg font-bold ${getTimeColor()}`}>
        <Clock className="w-5 h-5" />
        {time}
      </div>
    );
  };


  // Toggle grill order completion
  const toggleGrillCompletion = (orderId: number) => {
    setCompletedOrders((prev) => {
      const updated = new Set(prev);

      if (updated.has(orderId)) {
        // Undo
        updated.delete(orderId);
        showToast(`Order #${orderId} restored`, 'info');
      } else {
        // Mark complete
        setFadingOrders((fadePrev) => new Set(fadePrev).add(orderId));
        setTimeout(() => {
          setFadingOrders((fadePrev) => {
            const newFade = new Set(fadePrev);
            newFade.delete(orderId);
            return newFade;
          });
          updated.add(orderId);
        }, 300); // match fade duration
        showToast(`Order #${orderId} marked as done`, 'success');
      }

      return updated;
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-slate-50 pb-24">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col gap-3">
            {/* Top row: Title + Logout */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-red-500 rounded-lg flex items-center justify-center shadow-lg">
                  <Flame className="w-7 h-7 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-slate-900">🔥 Grill Orders</h1>
                  <p className="text-sm text-slate-600">Welcome, {user?.username}</p>
                </div>
              </div>

              {/* Logout button */}
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition"
              >
                <LogOut className="w-4 h-4" />
                Logout
              </button>
            </div>

            {/* Second row: Live Orders / Archive Toggle Buttons */}
            <div className="w-full">
              <div className="flex items-center justify-center gap-3">
                {/* Live Orders Button */}
                <button
                  onClick={() => setShowArchive(false)}
                  className={`flex items-center gap-2 px-5 py-3 rounded-lg text-lg font-semibold shadow-md transition-all ${!showArchive
                    ? 'bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-lg scale-[1.02]'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                >
                  <span
                    className={`w-3.5 h-3.5 rounded-full border-2 border-white ${isConnected ? 'bg-green-400 animate-pulse' : 'bg-red-400'
                      }`}
                  />
                  Live Orders ({orders.filter((o) => !completedOrders.has(o.id)).length})
                </button>

                {/* Archive Button */}
                <button
                  onClick={() => setShowArchive(true)}
                  className={`px-5 py-3 rounded-lg text-lg font-semibold shadow-md transition-all ${showArchive
                    ? 'bg-gradient-to-r from-slate-600 to-slate-700 text-white shadow-lg scale-[1.02]'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                >
                  Archive ({orders.filter((o) => completedOrders.has(o.id)).length})
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>





      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
          </div>
        ) : orders.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm p-12 border border-slate-200 text-center">
            <Flame className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-slate-900 mb-2">No Active Orders</h2>
            <p className="text-slate-600">
              Grill orders will appear here in real-time when servers submit them.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {
              orders
                .filter((order) =>
                  showArchive
                    ? completedOrders.has(order.id) // show archived
                    : !completedOrders.has(order.id) // show live
                )
                .map((order) => {
                  const isCompleted = completedOrders.has(order.id);
                  const isFading = fadingOrders.has(order.id);
                  return (
                    <div
                      key={order.id}
                      className={`relative bg-white rounded-xl shadow-md border-2 p-6 transition-all duration-500 transform ${highlightedOrders.has(order.id)
                        ? 'border-orange-500 bg-orange-50 scale-[1.02]'
                        : isCompleted
                          ? 'border-green-300 bg-green-50 opacity-70'
                          : 'border-slate-200 hover:shadow-lg'
                        } ${isFading ? 'opacity-0 scale-95' : 'opacity-100 scale-100'}`}
                    >
                      {/* Order Header */}
                      <div className="flex items-start justify-between mb-4 pb-4 border-b border-slate-200">
                        <div>
                          <div className="flex items-center gap-3 mb-2">
                            <span className="text-3xl font-black text-orange-600">
                              #{order.orderNumber}
                            </span>
                            {order.tableNumber && (
                              <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-lg font-semibold text-sm">
                                Table {order.tableNumber}
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-slate-600">
                            Server: <span className="font-medium">{order.server.username}</span>
                          </p>
                        </div>

                        {/* Timer + Done button */}
                        <div className="flex flex-col items-end gap-2">
                          <LiveTimer createdAt={order.createdAt} />
                          <button
                            onClick={() => toggleGrillCompletion(order.id)}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-semibold shadow transition ${isCompleted
                              ? 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                              : 'bg-gradient-to-r from-green-500 to-emerald-600 text-white hover:from-green-600 hover:to-emerald-700'
                              }`}
                          >
                            <CheckCircle className="w-4 h-4" />
                            {isCompleted ? 'Undo' : 'Done'}
                          </button>
                        </div>
                      </div>

                      {/* Order Items */}
                      <div className="space-y-3">
                        {order.items.map((item) => (
                          <div
                            key={item.id}
                            className={`flex items-start justify-between p-3 rounded-lg ${isCompleted ? 'bg-slate-100' : 'bg-slate-50'
                              }`}
                          >
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span
                                  className={`text-2xl font-bold ${isCompleted ? 'text-slate-400' : 'text-orange-600'
                                    }`}
                                >
                                  {item.quantity}x
                                </span>
                                <span
                                  className={`text-lg font-semibold ${isCompleted
                                    ? 'text-slate-500 line-through'
                                    : 'text-slate-900'
                                    }`}
                                >
                                  {item.menuItem.name}
                                </span>
                              </div>
                              {item.notes && (
                                <div className="flex items-start gap-2 mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded">
                                  <AlertCircle className="w-4 h-4 text-yellow-600 mt-0.5 flex-shrink-0" />
                                  <p className="text-sm text-yellow-800 font-medium">{item.notes}</p>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })
            }

            {/* Show No Orders Found */}
            {showArchive && orders.every((o) => !completedOrders.has(o.id)) && (
              <div className="bg-white rounded-xl shadow-sm p-8 border border-slate-200 text-center text-slate-600">
                No archived grill orders yet.
              </div>
            )}


          </div>
        )}
      </main>

      {/* Clear All Button - Fixed Bottom */}
      {orders.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 shadow-lg z-20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <button
              onClick={() => setShowClearModal(true)}
              disabled={clearing}
              className="w-full py-4 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white rounded-lg transition font-bold text-lg flex items-center justify-center gap-3 disabled:opacity-50 shadow-lg"
            >
              {clearing ? (
                <>
                  <Loader2 className="w-6 h-6 animate-spin" />
                  Clearing...
                </>
              ) : (
                <>
                  <Trash2 className="w-6 h-6" />
                  Remove All Orders ({orders.filter((o) => !completedOrders.has(o.id)).length})
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Clear Confirmation Modal */}
      {showClearModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 max-w-md w-full shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                <AlertCircle className="w-6 h-6 text-red-600" />
              </div>
              <h3 className="text-xl font-bold text-slate-900">Clear All Orders?</h3>
            </div>
            <p className="text-slate-600 mb-6">
              This will mark all {orders.length} grill {orders.length === 1 ? 'order' : 'orders'} as completed.
              This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowClearModal(false)}
                disabled={clearing}
                className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition font-medium"
              >
                Cancel
              </button>
              <button
                onClick={clearAllOrders}
                disabled={clearing}
                className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg transition font-medium flex items-center justify-center gap-2"
              >
                {clearing ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  'Yes, Clear All'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notifications */}
      {toast && (
        <div className="fixed bottom-24 right-4 z-50 animate-slide-up">
          <div
            className={`flex items-center gap-3 px-6 py-4 rounded-lg shadow-lg ${toast.type === 'success'
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

export default GrillView;
