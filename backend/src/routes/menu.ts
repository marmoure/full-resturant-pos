import { Router, Response } from 'express';
import { prisma } from '../index';
import { authenticateToken, AuthRequest } from '../middleware/auth';

const router = Router();

// GET /menu - Get all active menu items
router.get('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const menuItems = await prisma.menuItem.findMany({
      where: { active: true },
      orderBy: [
        { category: 'asc' },
        { name: 'asc' },
      ],
    });

    res.json({
      status: 'success',
      data: menuItems,
    });
  } catch (error) {
    console.error('Error fetching menu items:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch menu items',
    });
  }
});

// GET /menu/:id - Get single menu item
router.get('/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const menuItem = await prisma.menuItem.findUnique({
      where: { id: parseInt(id) },
    });

    if (!menuItem) {
      return res.status(404).json({
        status: 'error',
        message: 'Menu item not found',
      });
    }

    res.json({
      status: 'success',
      data: menuItem,
    });
  } catch (error) {
    console.error('Error fetching menu item:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch menu item',
    });
  }
});

// GET /menu/category/:category - Get menu items by category
router.get('/category/:category', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { category } = req.params;

    const menuItems = await prisma.menuItem.findMany({
      where: {
        category,
        active: true,
      },
      orderBy: { name: 'asc' },
    });

    res.json({
      status: 'success',
      data: menuItems,
    });
  } catch (error) {
    console.error('Error fetching menu items by category:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch menu items',
    });
  }
});

export default router;
