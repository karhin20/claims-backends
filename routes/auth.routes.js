import { Router } from 'express';
import { signUp, signIn, signOut, getSession } from '../controllers/auth.controller.js';

const router = Router();

router.post('/signup', signUp);
router.post('/signin', signIn);
router.post('/signout', signOut);
router.get('/session', async (req, res) => {
  try {
    // ... session logic ...
    
    res.header('Access-Control-Allow-Origin', req.headers.origin);
    res.header('Access-Control-Allow-Credentials', 'true');
    res.json({ /* session data */ });
  } catch (error) {
    console.error('Session error:', error);
    res.status(401).json({ error: 'Unauthorized' });
  }
});

export default router; 