import express from 'express';
import cors from 'cors';
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

const corsOptions = {
  origin: [
    'http://localhost:8080',
    'http://localhost:5173',
    'https://claimsgh.netlify.app'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'Cookie', 'X-Requested-With']
};

// Apply CORS to auth routes
router.use(cors(corsOptions));

router.post('/signup', signUp);
router.post('/signin', signIn);
router.post('/signout', signOut);
router.get('/session', async (req, res) => {
  try {
    // Add CORS headers explicitly
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Allow-Origin', req.headers.origin);
    
    // Your session logic here
    // ...
  } catch (error) {
    console.error('Session error:', error);
    res.status(500).json({ message: 'Failed to get session' });
  }
});
router.post('/request-reset', requestPasswordReset);
router.post('/reset-password', resetPassword);
router.post('/invite', inviteUser);
router.post('/magic-link', signInWithMagicLink);

export default router; 