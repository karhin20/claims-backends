import express from 'express';
import { 
  signIn, 
  signOut, 
  signUp, 
  getSession, 
} from '../controllers/auth.controller.js';
import { verifySession } from '../middlewares/auth.middleware.js';

const router = express.Router();

// Auth routes
router.post('/signup', signUp);
router.post('/signin', signIn);
router.post('/signout', signOut);
router.get('/session', getSession);

// Protected routes example
router.get('/protected', verifySession, (req, res) => {
  res.json({ message: 'Access granted to protected route', user: req.user });
});

export default router;