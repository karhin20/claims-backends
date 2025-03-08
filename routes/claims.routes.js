import express from 'express';
import {
  createClaim,
  getClaims,
  updateClaim,
  generateApprovalOTP,
  verifyApprovalOTP,
  getStats,
  getRecentActivity,
  getClaimById
} from '../controllers/claims.controller.js';
import { verifySession, requireAdmin } from '../middlewares/auth.middleware.js';

const router = express.Router();

// Apply verifySession middleware to all routes
router.use(verifySession);

// Stats and activity routes
router.get('/stats', getStats);
router.get('/recent', getRecentActivity);

// Admin-only routes
router.get('/', requireAdmin, getClaims);
router.post('/', requireAdmin, createClaim);
router.put('/:id', requireAdmin, updateClaim);
router.post('/:id/generate-otp', requireAdmin, generateApprovalOTP);
router.post('/:id/verify-otp', requireAdmin, verifyApprovalOTP);
router.get('/:id', requireAdmin, getClaimById);

// Update the UUID validation regex
router.param('id', (req, res, next, id) => {
  if (!id.match(/^[0-9a-fA-F-]{36}$/)) {
    return res.status(400).json({ message: 'Invalid claim ID format' });
  }
  next();
});

export default router; 