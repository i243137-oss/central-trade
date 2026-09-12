import jwt from 'jsonwebtoken';
import config from '../config/config.js';
import dbManager from '../services/database/ManagementOfDatabase.js';

/**
 * Authentication Middleware
 * Enforces R10 (Authorization):
 * Role-based access control with USER and SYSTEM_MANAGER
 */
export async function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Authentication token required.',
      errorCode: 'UNAUTHORIZED'
    });
  }

  try {
    const decoded = jwt.verify(token, config.jwtSecret);
    const user = await dbManager.findUserById(decoded.id);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid user session or user no longer exists.',
        errorCode: 'INVALID_TOKEN'
      });
    }

    req.user = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role
    };
    next();
  } catch (err) {
    return res.status(403).json({
      success: false,
      message: 'Forbidden: Invalid or expired token.',
      errorCode: 'FORBIDDEN_TOKEN'
    });
  }
}

/**
 * Role-Based Access Control Middleware
 * @param {string|string[]} roles - 'SYSTEM_MANAGER' or 'USER'
 */
export function requireRole(roles) {
  const allowed = Array.isArray(roles) ? roles : [roles];
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required.',
        errorCode: 'UNAUTHENTICATED'
      });
    }

    if (!allowed.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Forbidden: Access restricted to authorized roles (${allowed.join(', ')}). Your role: ${req.user.role}.`,
        errorCode: 'ACCESS_DENIED_ROLE'
      });
    }

    next();
  };
}
