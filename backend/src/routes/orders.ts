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

// DELETE /orders/grill - Clear all grill orders
router.delete('/grill', authenticateToken, requireRole(['GRILL_COOK', 'OWNER']), async (req: AuthRequest, res: Response) => {
  try {
    // Find all OPEN orders with grill items
    const grillOrders = await prisma.order.findMany({
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
      select: { id: true },
    });

    if (grillOrders.length === 0) {
      return res.json({
        status: 'success',
        message: 'No grill orders to clear',
        data: { cleared: 0 },
      });
    }

    const orderIds = grillOrders.map((order) => order.id);

    // Update all grill orders to COMPLETED
    const result = await prisma.order.updateMany({
      where: {
        id: { in: orderIds },
      },
      data: {
        status: 'COMPLETED',
      },
    });

    console.info(`✅ Cleared ${result.count} grill orders`);

    // Broadcast clear event
    broadcast('grill:clear', { cleared: result.count, orderIds });

    res.json({
      status: 'success',
      message: `Cleared ${result.count} grill orders`,
      data: { cleared: result.count },
    });
  } catch (error) {
    console.error('Error clearing grill orders:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to clear grill orders',
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

export default router;
