import { Router } from 'express';
import { authController } from '../controllers/auth.controller.js';  // Note: Added .js extension

const router = Router();

router.post('/signup', authController.signUp);
router.post('/signin', authController.signIn);
router.post('/signout', authController.signOut);
router.get('/session', authController.getSession);

export default router; 