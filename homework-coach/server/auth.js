const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const db = require('./db');

const JWT_SECRET = process.env.JWT_SECRET || 'homework-coach-secret-key-change-in-production';
const JWT_EXPIRES_IN = '7d';

// Hash password
async function hashPassword(password) {
  return bcrypt.hash(password, 12);
}

// Compare password
async function comparePassword(password, hash) {
  return bcrypt.compare(password, hash);
}

// Generate JWT token
function generateToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

// Verify JWT token
function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return null;
  }
}

// Auth middleware - requires valid token
function requireAuth(req, res, next) {
  const token = req.cookies?.token || req.headers.authorization?.replace('Bearer ', '');

  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const decoded = verifyToken(token);
  if (!decoded) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  req.family = decoded;
  next();
}

// Optional auth - attaches family if token present
function optionalAuth(req, res, next) {
  const token = req.cookies?.token || req.headers.authorization?.replace('Bearer ', '');

  if (token) {
    const decoded = verifyToken(token);
    if (decoded) {
      req.family = decoded;
    }
  }

  next();
}

// Middleware to require child selection
async function requireChild(req, res, next) {
  if (!req.family) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const childId = req.headers['x-child-id'] || req.query.childId;

  if (!childId) {
    return res.status(400).json({ error: 'Child profile selection required' });
  }

  // Verify child belongs to this family
  try {
    const result = await db.query(
      'SELECT * FROM children WHERE id = $1 AND family_id = $2',
      [childId, req.family.familyId]
    );

    if (result.rows.length === 0) {
      return res.status(403).json({ error: 'Child not found or access denied' });
    }

    req.child = result.rows[0];
    next();
  } catch (error) {
    console.error('Error verifying child:', error);
    res.status(500).json({ error: 'Server error' });
  }
}

module.exports = {
  hashPassword,
  comparePassword,
  generateToken,
  verifyToken,
  requireAuth,
  optionalAuth,
  requireChild,
};
