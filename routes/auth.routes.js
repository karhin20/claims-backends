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
import cors from 'cors';

const router = express.Router();

// Define allowed origins
const allowedOrigins = [
  'http://localhost:8080',
  'http://localhost:5173',
  'https://claimsgh.netlify.app',
  'https://claims-backends.vercel.app'
];

const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'Accept',
    'Cookie',
    'X-Requested-With'
  ],
  exposedHeaders: ['Set-Cookie']
};

router.use(cors(corsOptions));

router.post('/signup', signUp);
router.post('/signin', async (req, res) => {
  try {
    const { email, password } = req.body;
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) throw error;

    // Set session cookie with proper CORS settings
    res.cookie('session', data.session.access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      domain: process.env.NODE_ENV === 'production' ? '.vercel.app' : 'localhost'
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