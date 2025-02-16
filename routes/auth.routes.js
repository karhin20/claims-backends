import express from 'express';
import {
  signUp,
  signIn,
  signOut,
  requestPasswordReset,
  resetPassword,
  getSession,
  inviteUser,
  signInWithMagicLink
} from '../controllers/auth.controller.js';

const router = express.Router();

router.post('/signup', signUp);
router.post('/signin', signIn);
router.post('/signout', signOut);
router.get('/session', getSession);
router.post('/request-reset', requestPasswordReset);
router.post('/reset-password', resetPassword);
router.post('/invite', inviteUser);
router.post('/magic-link', signInWithMagicLink);

export default router; 