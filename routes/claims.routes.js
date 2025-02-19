import express from 'express';
import { auth } from '../middleware/auth.js';
import {
  createClaim,
  getClaims,
  updateClaim,
  generateApprovalOTP,
  verifyApprovalOTP,
  getStats,
  getRecentActivity
} from '../controllers/claims.controller.js';

const router = express.Router();

// Add auth middleware to all routes
router.use(auth);

// Stats and activity routes
router.get('/stats', getStats);
router.get('/recent', getRecentActivity);

// Regular claim routes
router.get('/', getClaims);
router.post('/', createClaim);
router.put('/:id', updateClaim);
router.post('/:id/generate-otp', generateApprovalOTP);
router.post('/:id/verify-otp', verifyApprovalOTP);

// UUID validation
router.param('id', (req, res, next, id) => {
  if (!id.match(/^[0-9a-fA-F-]{36}$/)) {
    return res.status(400).json({ message: 'Invalid claim ID format' });
  }
  next();
});

export default router; 