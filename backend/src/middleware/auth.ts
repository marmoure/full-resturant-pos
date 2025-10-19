import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../index';

// Extend Express Request type to include user
export interface AuthRequest extends Request {
  user?: {
    id: number;
    username: string;
    roleId: number;
    roleName: string;
  };
}

// Verify JWT token and attach user to request
export const authenticateToken = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({ 
        status: 'error',
        message: 'Access token required' 
      });
    }

    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new Error('JWT_SECRET not configured');
    }

    // Verify token
    const decoded = jwt.verify(token, secret) as {
      id: number;
      username: string;
      roleId: number;
    };

    // Fetch user with role from database
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      include: { role: true },
    });

    if (!user || !user.isActive) {
      return res.status(401).json({ 
        status: 'error',
        message: 'User not found or inactive' 
      });
    }

    // Attach user to request
    req.user = {
      id: user.id,
      username: user.username,
      roleId: user.roleId,
      roleName: user.role.name,
    };

    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      return res.status(403).json({ 
        status: 'error',
        message: 'Invalid or expired token' 
      });
    }
    return res.status(500).json({ 
      status: 'error',
      message: 'Authentication failed' 
    });
  }
};

// Middleware to check if user has required role(s)
export const requireRole = (allowedRoles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ 
        status: 'error',
        message: 'Authentication required' 
      });
    }

    if (!allowedRoles.includes(req.user.roleName)) {
      return res.status(403).json({ 
        status: 'error',
        message: 'Insufficient permissions',
        required: allowedRoles,
        current: req.user.roleName,
      });
    }

    next();
  };
};
