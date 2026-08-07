import express from 'express';
import * as authController from '../controllers/authController.js';
import { auth } from '../middleware/auth.js';

const router = express.Router();

// Route de health check
router.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', service: 'auth-service' });
});

// Routes d'authentification
router.post('/register', authController.register);
router.post('/login', authController.login);
router.get('/profile', auth, authController.getProfile);

export default router;
