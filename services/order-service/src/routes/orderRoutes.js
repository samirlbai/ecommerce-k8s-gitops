import express from 'express';
import * as orderController from '../controllers/orderController.js';
import { auth } from '../middleware/auth.js';

const router = express.Router();

// Routes protégées par authentification
router.use(auth);

// Créer une nouvelle commande
router.post('/', orderController.createOrder);

// Obtenir toutes les commandes de l'utilisateur
router.get('/', orderController.getOrders);

// Obtenir une commande spécifique
router.get('/:id', orderController.getOrderById);

// Mettre à jour le statut d'une commande
router.patch('/:id/status', orderController.updateOrderStatus);

// Annuler une commande
router.delete('/:id', orderController.cancelOrder);

export default router;