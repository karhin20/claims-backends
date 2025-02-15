import { Router } from 'express';
import { signUp, signIn, signOut, getSession, resetPassword } from '../controllers/auth.controller.js';

const router = Router();

router.post('/signup', signUp);
router.post('/signin', signIn);
router.post('/signout', signOut);
router.get('/session', getSession);
router.post('/reset-password', resetPassword);

export default router; 