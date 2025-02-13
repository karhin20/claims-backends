import { Router } from 'express';
import {
  createClaim,
  getClaims,
  getClaimById,
  updateClaim,
  generateApprovalOTP,
  verifyApprovalOTP
} from '../controllers/claims.controller.js';

const router = Router();

router.post('/', createClaim);
router.get('/', getClaims);
router.get('/:id', getClaimById);
router.put('/:id', updateClaim);
router.post('/:claimId/generate-otp', generateApprovalOTP);
router.post('/:claimId/verify-otp', verifyApprovalOTP);

export default router; 