import { Router } from 'express';
import {
  createClaim,
  getClaims,
  getClaimById,
  updateClaim,
  generateApprovalOTP,
  verifyApprovalOTP,
  checkAdmin
} from '../controllers/claims.controller.js';

const router = Router();

// Public routes (require authentication but not admin)
router.get('/', getClaims);
router.get('/:id', getClaimById);

// Admin only routes
router.post('/', checkAdmin, createClaim);
router.put('/:id', checkAdmin, updateClaim);
router.post('/:claimId/generate-otp', checkAdmin, generateApprovalOTP);
router.post('/:claimId/verify-otp', checkAdmin, verifyApprovalOTP);

export default router; 