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
router.post('/signin', async (req, res) => {
  try {
    const { email, password } = req.body;
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) throw error;

    // Set session cookie
    res.cookie('session', data.session.access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    res.json({
      user: data.user,
      message: 'Signed in successfully'
    });
  } catch (error) {
    console.error('Sign in error:', error);
    res.status(401).json({ message: error.message });
  }
});
router.post('/signout', signOut);
router.get('/session', getSession);
router.post('/request-reset', requestPasswordReset);
router.post('/reset-password', resetPassword);
router.post('/invite', inviteUser);
router.post('/magic-link', signInWithMagicLink);

// Add session verification middleware
export const verifySession = async (req, res, next) => {
  try {
    const sessionToken = req.cookies.session;
    if (!sessionToken) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const { data: { user }, error } = await supabase.auth.getUser(sessionToken);
    if (error || !user) {
      return res.status(401).json({ message: 'Invalid session' });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('Session verification error:', error);
    res.status(401).json({ message: 'Authentication required' });
  }
};

export default router; 