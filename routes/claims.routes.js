import express from 'express';
import {
  createClaim,
  getClaims,
  updateClaim,
  generateApprovalOTP,
  verifyApprovalOTP,
  getStats,
  getRecentActivity,
  checkOTPStatus
} from '../controllers/claims.controller.js';
import { auth } from '../middleware/auth.js';  // Make sure auth middleware is imported

const router = express.Router();

// Base path is already /api/claims from app.js/index.js
router.get('/stats', auth, getStats);
router.get('/recent', auth, getRecentActivity);

// Main routes
router.get('/', auth, getClaims);
router.post('/', auth, createClaim);
router.put('/:id', auth, updateClaim);

// OTP routes with auth middleware
router.post('/:id/generate-otp', auth, async (req, res, next) => {
  try {
    console.log('Route hit with params:', req.params);  // Debug log
    console.log('User from auth:', req.user);          // Debug log
    
    if (!req.params.id) {
      return res.status(400).json({ message: 'Claim ID is required' });
    }
    next();
  } catch (error) {
    next(error);
  }
}, generateApprovalOTP);

router.post('/:id/verify-otp', auth, verifyApprovalOTP);

// Add debug route for OTP status (only in development)
if (process.env.NODE_ENV === 'development') {
  router.get('/:id/check-otp', auth, checkOTPStatus);
}

// UUID validation
router.param('id', (req, res, next, id) => {
  if (!id.match(/^[0-9a-fA-F-]{36}$/)) {
    return res.status(400).json({ 
      message: 'Invalid claim ID format',
      details: 'The provided ID is not a valid UUID'
    });
  }
  next();
});

export default router; 