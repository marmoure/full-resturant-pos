import { Router, Response } from 'express';
import { prisma } from '../index';
import { authenticateToken, AuthRequest, requireRole } from '../middleware/auth';
import { getNextOrderNumber } from '../utils/orderNumber';
import { broadcast, WS_EVENTS } from '../websocket/server';

const router = Router();

// POST /orders - Create new order
router.post('/', authenticateToken, requireRole(['SERVER']), async (req: AuthRequest, res: Response) => {
  try {
    const { items, tableNumber } = req.body;

    if (!req.user) {
      return res.status(401).json({
        status: 'error',
        message: 'User not authenticated',
      });
    }

    // Validate items
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        status: 'error',
        message: 'Items array is required and must not be empty',
      });
    }

    // Fetch menu items to calculate total and validate
    const menuItemIds = items.map((item: any) => item.menuItemId);
    const menuItems = await prisma.menuItem.findMany({
      where: { id: { in: menuItemIds } },
    });

    if (menuItems.length !== menuItemIds.length) {
      return res.status(400).json({
        status: 'error',
        message: 'One or more menu items not found',
      });
    }

    // Calculate total price
    let totalPrice = 0;
    const orderItemsData = items.map((item: any) => {
      const menuItem = menuItems.find((mi) => mi.id === item.menuItemId);
      if (!menuItem) {
        throw new Error('Menu item not found');
      }
      const itemTotal = menuItem.price * item.quantity;
      totalPrice += itemTotal;

      return {
        menuItemId: item.menuItemId,
        quantity: item.quantity,
        price: menuItem.price,
        notes: item.notes || null,
      };
    });

    // Get next order number (auto-resets daily)
    const orderNumber = getNextOrderNumber();

    // Create order with items
    const order = await prisma.order.create({
      data: {
        orderNumber,
        serverId: req.user.id,
        totalPrice,
        tableNumber: tableNumber || null,
        status: 'OPEN',
        items: {
          create: orderItemsData,
        },
      },
      include: {
        items: {
          include: {
            menuItem: true,
          },
        },
        server: {
          select: {
            id: true,
            username: true,
          },
        },
      },
    });

    console.info(`✅ Order created: #${order.orderNumber} by ${req.user.username}`);

    // Broadcast to all connected clients
    broadcast(WS_EVENTS.ORDER_NEW, order);

    res.status(201).json({
      status: 'success',
      message: 'Order created successfully',
      data: order,
    });
  } catch (error) {
    console.error('Error creating order:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to create order',
    });
  }
});

// GET /orders - Get all orders (with optional filters)
router.get('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { status, serverId } = req.query;

    const where: any = {};
    if (status) where.status = status;
    if (serverId) where.serverId = parseInt(serverId as string);

    const orders = await prisma.order.findMany({
      where,
      include: {
        items: {
          include: {
            menuItem: true,
          },
        },
        server: {
          select: {
            id: true,
            username: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({
      status: 'success',
      data: orders,
    });
  } catch (error) {
    console.error('Error fetching orders:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch orders',
    });
  }
});

// DELETE /orders/last - Cancel the most recent order
router.delete('/last', authenticateToken, requireRole(['SERVER']), async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        status: 'error',
        message: 'User not authenticated',
      });
    }

    // Find the most recent order by this server
    const lastOrder = await prisma.order.findFirst({
      where: {
        serverId: req.user.id,
        status: 'OPEN',
      },
      orderBy: { createdAt: 'desc' },
      include: {
        items: {
          include: {
            menuItem: true,
          },
        },
      },
    });

    if (!lastOrder) {
      return res.status(404).json({
        status: 'error',
        message: 'No recent order found to cancel',
      });
    }

    // Update status to CANCELLED instead of deleting
    const cancelledOrder = await prisma.order.update({
      where: { id: lastOrder.id },
      data: { status: 'CANCELLED' },
      include: {
        items: {
          include: {
            menuItem: true,
          },
        },
        server: {
          select: {
            id: true,
            username: true,
          },
        },
      },
    });

    console.info(`✅ Order cancelled: #${cancelledOrder.orderNumber}`);

    // Broadcast cancellation
    broadcast(WS_EVENTS.ORDER_CANCEL, cancelledOrder);

    res.json({
      status: 'success',
      message: 'Order cancelled successfully',
      data: cancelledOrder,
    });
  } catch (error) {
    console.error('Error cancelling order:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to cancel order',
    });
  }
});

// GET /orders/active - Get all active orders for the logged-in server
router.get('/active', authenticateToken, requireRole(['SERVER']), async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        status: 'error',
        message: 'User not authenticated',
      });
    }

    // Fetch all OPEN orders for this server
    const orders = await prisma.order.findMany({
      where: {
        status: 'OPEN',
        serverId: req.user.id,
      },
      include: {
        items: {
          include: {
            menuItem: true,
          },
        },
        server: {
          select: {
            id: true,
            username: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({
      status: 'success',
      data: orders,
    });
  } catch (error) {
    console.error('Error fetching active orders:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch active orders',
    });
  }
});

// GET /orders/cashier - Get all active orders for cashier (OPEN and SERVED)
router.get('/cashier', authenticateToken, requireRole(['CASHIER', 'OWNER']), async (req: AuthRequest, res: Response) => {
  try {
    // Fetch all OPEN and SERVED orders for cashier to process
    const orders = await prisma.order.findMany({
      where: {
        status: {
          in: ['OPEN', 'SERVED'],
        },
      },
      include: {
        items: {
          include: {
            menuItem: true,
          },
        },
        server: {
          select: {
            id: true,
            username: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    res.json({
      status: 'success',
      data: orders,
    });
  } catch (error) {
    console.error('Error fetching cashier orders:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch cashier orders',
    });
  }
});

// GET /orders/grill - Get all active grill orders
router.get('/grill', authenticateToken, requireRole(['GRILL_COOK', 'OWNER']), async (req: AuthRequest, res: Response) => {
  try {
    // Fetch all OPEN orders that have grill items
    const orders = await prisma.order.findMany({
      where: {
        status: 'OPEN',
        items: {
          some: {
            menuItem: {
              station: 'grill',
            },
          },
        },
      },
      include: {
        items: {
          where: {
            menuItem: {
              station: 'grill',
            },
          },
          include: {
            menuItem: true,
          },
        },
        server: {
          select: {
            id: true,
            username: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    res.json({
      status: 'success',
      data: orders,
    });
  } catch (error) {
    console.error('Error fetching grill orders:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch grill orders',
    });
  }
});

// GET /orders/kitchen - Get all active kitchen orders (non-grill items)
router.get('/kitchen', authenticateToken, requireRole(['KITCHEN_STAFF', 'OWNER']), async (req: AuthRequest, res: Response) => {
  try {
    // Fetch all OPEN orders that have kitchen items (station = 'kitchen')
    const orders = await prisma.order.findMany({
      where: {
        status: 'OPEN',
        items: {
          some: {
            menuItem: {
              station: 'kitchen',
            },
          },
        },
      },
      include: {
        items: {
          where: {
            menuItem: {
              station: 'kitchen',
            },
          },
          include: {
            menuItem: true,
          },
        },
        server: {
          select: {
            id: true,
            username: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    res.json({
      status: 'success',
      data: orders,
    });
  } catch (error) {
    console.error('Error fetching kitchen orders:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch kitchen orders',
    });
  }
});

// GET /orders/:id - Get single order
router.get('/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const order = await prisma.order.findUnique({
      where: { id: parseInt(id) },
      include: {
        items: {
          include: {
            menuItem: true,
          },
        },
        server: {
          select: {
            id: true,
            username: true,
          },
        },
      },
    });

    if (!order) {
      return res.status(404).json({
        status: 'error',
        message: 'Order not found',
      });
    }

    res.json({
      status: 'success',
      data: order,
    });
  } catch (error) {
    console.error('Error fetching order:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch order',
    });
  }
});

// PATCH /orders/:id/served - Mark order as served
router.patch('/:id/served', authenticateToken, requireRole(['SERVER']), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    if (!req.user) {
      return res.status(401).json({
        status: 'error',
        message: 'User not authenticated',
      });
    }

    // Find the order and verify ownership
    const existingOrder = await prisma.order.findUnique({
      where: { id: parseInt(id) },
      include: {
        items: {
          include: {
            menuItem: true,
          },
        },
      },
    });

    if (!existingOrder) {
      return res.status(404).json({
        status: 'error',
        message: 'Order not found',
      });
    }

    // Verify that the order belongs to this server
    if (existingOrder.serverId !== req.user.id) {
      return res.status(403).json({
        status: 'error',
        message: 'You can only mark your own orders as served',
      });
    }

    // Only allow marking OPEN orders as served
    if (existingOrder.status !== 'OPEN') {
      return res.status(400).json({
        status: 'error',
        message: 'Only OPEN orders can be marked as served',
      });
    }

    // Update order status to served
    const updatedOrder = await prisma.order.update({
      where: { id: parseInt(id) },
      data: { status: 'SERVED' },
      include: {
        items: {
          include: {
            menuItem: true,
          },
        },
        server: {
          select: {
            id: true,
            username: true,
          },
        },
      },
    });

    console.info(`✅ Order marked as served: #${updatedOrder.orderNumber} by ${req.user.username}`);

    // Broadcast order served event
    broadcast(WS_EVENTS.ORDER_SERVED, updatedOrder);

    res.json({
      status: 'success',
      message: 'Order marked as served',
      data: updatedOrder,
    });
  } catch (error) {
    console.error('Error marking order as served:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to mark order as served',
    });
  }
});

// PATCH /orders/:id/checkout - Complete order checkout (cashier only)
router.patch('/:id/checkout', authenticateToken, requireRole(['CASHIER', 'OWNER']), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    if (!req.user) {
      return res.status(401).json({
        status: 'error',
        message: 'User not authenticated',
      });
    }

    // Find the order
    const existingOrder = await prisma.order.findUnique({
      where: { id: parseInt(id) },
      include: {
        items: {
          include: {
            menuItem: true,
          },
        },
        server: {
          select: {
            id: true,
            username: true,
          },
        },
      },
    });

    if (!existingOrder) {
      return res.status(404).json({
        status: 'error',
        message: 'Order not found',
      });
    }

    // Only allow completing OPEN or SERVED orders
    if (existingOrder.status !== 'OPEN' && existingOrder.status !== 'SERVED') {
      return res.status(400).json({
        status: 'error',
        message: 'Only OPEN or SERVED orders can be completed',
      });
    }

    // Update order status to COMPLETED
    const completedOrder = await prisma.order.update({
      where: { id: parseInt(id) },
      data: { 
        status: 'COMPLETED',
        updatedAt: new Date(),
      },
      include: {
        items: {
          include: {
            menuItem: true,
          },
        },
        server: {
          select: {
            id: true,
            username: true,
          },
        },
      },
    });

    console.info(`✅ Order completed: #${completedOrder.orderNumber} by cashier ${req.user.username}`);

    // Broadcast order completed event
    broadcast(WS_EVENTS.ORDER_COMPLETED, completedOrder);

    res.json({
      status: 'success',
      message: 'Order completed successfully',
      data: completedOrder,
    });
  } catch (error) {
    console.error('Error completing order:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to complete order',
    });
  }
});

// PATCH /orders/:id - Update existing order (add/remove items)
router.patch('/:id', authenticateToken, requireRole(['SERVER']), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { items, status, tableNumber } = req.body;

    const existingOrder = await prisma.order.findUnique({
      where: { id: parseInt(id) },
      include: { items: true },
    });

    if (!existingOrder) {
      return res.status(404).json({
        status: 'error',
        message: 'Order not found',
      });
    }

    // Only allow updates to OPEN orders
    if (existingOrder.status !== 'OPEN') {
      return res.status(400).json({
        status: 'error',
        message: 'Cannot modify order that is not OPEN',
      });
    }

    const updateData: any = {};

    // Update items if provided
    if (items && Array.isArray(items)) {
      // Delete existing items
      await prisma.orderItem.deleteMany({
        where: { orderId: parseInt(id) },
      });

      // Fetch menu items
      const menuItemIds = items.map((item: any) => item.menuItemId);
      const menuItems = await prisma.menuItem.findMany({
        where: { id: { in: menuItemIds } },
      });

      // Calculate new total
      let totalPrice = 0;
      const orderItemsData = items.map((item: any) => {
        const menuItem = menuItems.find((mi) => mi.id === item.menuItemId);
        if (!menuItem) {
          throw new Error('Menu item not found');
        }
        const itemTotal = menuItem.price * item.quantity;
        totalPrice += itemTotal;

        return {
          menuItemId: item.menuItemId,
          quantity: item.quantity,
          price: menuItem.price,
          notes: item.notes || null,
        };
      });

      updateData.totalPrice = totalPrice;
      updateData.items = {
        create: orderItemsData,
      };
    }

    if (status) updateData.status = status;
    if (tableNumber !== undefined) updateData.tableNumber = tableNumber;

    // Update order
    const updatedOrder = await prisma.order.update({
      where: { id: parseInt(id) },
      data: updateData,
      include: {
        items: {
          include: {
            menuItem: true,
          },
        },
        server: {
          select: {
            id: true,
            username: true,
          },
        },
      },
    });

    console.info(`✅ Order updated: #${updatedOrder.orderNumber}`);

    // Broadcast update
    broadcast(WS_EVENTS.ORDER_UPDATE, updatedOrder);

    res.json({
      status: 'success',
      message: 'Order updated successfully',
      data: updatedOrder,
    });
  } catch (error) {
    console.error('Error updating order:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to update order',
    });
  }
});

// DELETE /orders/:id - Delete an order
router.delete('/:id', authenticateToken, requireRole(['SERVER']), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    if (!req.user) {
      return res.status(401).json({
        status: 'error',
        message: 'User not authenticated',
      });
    }

    // Find the order and verify ownership
    const existingOrder = await prisma.order.findUnique({
      where: { id: parseInt(id) },
      include: {
        items: {
          include: {
            menuItem: true,
          },
        },
        server: {
          select: {
            id: true,
            username: true,
          },
        },
      },
    });

    if (!existingOrder) {
      return res.status(404).json({
        status: 'error',
        message: 'Order not found',
      });
    }

    // Verify that the order belongs to this server
    if (existingOrder.serverId !== req.user.id) {
      return res.status(403).json({
        status: 'error',
        message: 'You can only delete your own orders',
      });
    }

    // Delete the order (cascade will delete order items)
    await prisma.order.delete({
      where: { id: parseInt(id) },
    });

    console.info(`✅ Order deleted: #${existingOrder.orderNumber} by ${req.user.username}`);

    // Broadcast order delete event
    broadcast(WS_EVENTS.ORDER_DELETE, existingOrder);

    res.json({
      status: 'success',
      message: 'Order deleted successfully',
      data: existingOrder,
    });
  } catch (error) {
    console.error('Error deleting order:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to delete order',
    });
  }
});

// DELETE /orders/kitchen - Clear all kitchen orders (mark as cleared)
router.delete('/kitchen', authenticateToken, requireRole(['KITCHEN_STAFF', 'OWNER']), async (req: AuthRequest, res: Response) => {
  try {
    // This endpoint broadcasts a kitchen:clear event to all connected clients
    // The actual clearing is handled on the frontend (local state management)
    // This is similar to how the grill view handles clearing
    
    console.info('🧹 Kitchen orders cleared by kitchen staff');

    // Broadcast kitchen clear event to all connected clients
    broadcast(WS_EVENTS.KITCHEN_CLEAR, { timestamp: new Date().toISOString() });

    res.json({
      status: 'success',
      message: 'Kitchen orders cleared successfully',
    });
  } catch (error) {
    console.error('Error clearing kitchen orders:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to clear kitchen orders',
    });
  }
});

export default router;
