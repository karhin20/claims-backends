import express from 'express';
import {
  createClaim,
  getClaims,
  getClaimById,
  updateClaim,
  generateApprovalOTP,
  verifyApprovalOTP,
  getStats,
  getRecentActivity,
  checkAdmin
} from '../controllers/claims.controller.js';
import { verifySession } from '../routes/auth.routes.js';

const router = express.Router();

// Apply verifySession middleware to all routes
router.use(verifySession);

// Public routes (still need authentication)
router.post('/', createClaim);
router.get('/', getClaims);
router.get('/stats', getStats);
router.get('/recent', getRecentActivity);
router.get('/:id', getClaimById);

// Admin-only routes
router.put('/:id', checkAdmin, updateClaim);
router.post('/:claimId/generate-otp', checkAdmin, generateApprovalOTP);
router.post('/:claimId/verify-otp', checkAdmin, verifyApprovalOTP);

export default router; 