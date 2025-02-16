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
import { supabase } from '../config/supabase.js';

const router = express.Router();

router.post('/signup', signUp);
router.post('/signin', signIn);
router.post('/signout', signOut);
router.get('/session', getSession);
router.post('/request-reset', requestPasswordReset);
router.post('/reset-password', resetPassword);
router.post('/invite', inviteUser);
router.post('/magic-link', signInWithMagicLink);

// Session verification middleware
export const verifySession = async (req, res, next) => {
  try {
    const sessionToken = req.cookies.session;
    if (!sessionToken) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    // Use Supabase's getUser with the session token
    const { data: { user }, error } = await supabase.auth.getUser(sessionToken);
    
    if (error) {
      console.error('Auth error:', error);
      return res.status(401).json({ message: 'Invalid session' });
    }

    if (!user) {
      return res.status(401).json({ message: 'User not found' });
    }

    // Add user to request object
    req.user = user;
    next();
  } catch (error) {
    console.error('Session verification error:', error);
    res.status(401).json({ message: 'Authentication required' });
  }
};

export default router; 