import express from 'express';
import {
  submitClaim,
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
router.post('/', submitClaim);
router.put('/:id([0-9a-fA-F-]{36})', updateClaim);
router.post('/:id([0-9a-fA-F-]{36})/generate-otp', generateApprovalOTP);
router.post('/:id([0-9a-fA-F-]{36})/verify-otp', verifyApprovalOTP);

// Catch-all for invalid claim IDs
router.use('/:id', (req, res) => {
  res.status(400).json({ message: 'Invalid claim ID format' });
});

export default router; 