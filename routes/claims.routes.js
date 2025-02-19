import express from 'express';
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

// Stats and activity routes must come BEFORE any :id routes
router.get('/stats', getStats);
router.get('/recent', getRecentActivity);

// Regular claim routes with :id parameter
router.get('/', getClaims);
router.post('/', createClaim);
router.put('/:id', updateClaim);
router.post('/:id/generate-otp', generateApprovalOTP);
router.post('/:id/verify-otp', verifyApprovalOTP);

// Update the UUID validation regex if needed
router.param('id', (req, res, next, id) => {
  if (!id.match(/^[0-9a-fA-F-]{36}$/)) {
    return res.status(400).json({ message: 'Invalid claim ID format' });
  }
  next();
});

export default router; 