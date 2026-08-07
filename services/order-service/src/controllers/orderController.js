// Fichier: src/controllers/orderController.js
import Order from '../models/order.js';
import axios from 'axios';

// Créer une nouvelle commande
export const createOrder = async (req, res) => {
  try {
    const { products, shippingAddress } = req.body;
    const userId = req.user.userId;

    // Vérifier si les produits sont fournis
    if (!products || !Array.isArray(products) || products.length === 0) {
      return res.status(400).json({ message: 'Liste de produits requise' });
    }

    // Vérifier la disponibilité des produits
    const productService = process.env.VITE_PRODUCT_SERVICE_URL || 'http://product-service:3000';
    let totalAmount = 0;
    const orderProducts = [];

    // Vérifier chaque produit
    for (const item of products) {
      try {
        const response = await axios.get(`${productService}/api/products/${item.productId}`);
        const product = response.data;

        if (product.stock < item.quantity) {
          return res.status(400).json({
            message: `Stock insuffisant pour ${product.name}`
          });
        }

        orderProducts.push({
          productId: product._id,
          name: product.name,
          price: product.price,
          quantity: item.quantity
        });

        totalAmount += product.price * item.quantity;
      } catch (error) {
        return res.status(400).json({
          message: `Produit non trouvé: ${item.productId}`
        });
      }
    }

    const order = new Order({
      userId,
      products: orderProducts,
      totalAmount,
      shippingAddress,
      status: 'pending'
    });

    await order.save();
    res.status(201).json(order);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Obtenir toutes les commandes d'un utilisateur
export const getOrders = async (req, res) => {
  try {
    const orders = await Order.find({ userId: req.user.userId });
    res.json(orders);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Obtenir une commande spécifique
export const getOrderById = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ message: 'Commande non trouvée' });
    }

    // Vérifier que l'utilisateur est propriétaire de la commande
    if (order.userId !== req.user.userId) {
      return res.status(403).json({ message: 'Accès non autorisé' });
    }

    res.json(order);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Mettre à jour le statut d'une commande
export const updateOrderStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const orderId = req.params.id;

    // Vérifier que le statut est valide
    const validStatuses = ['pending', 'confirmed', 'shipped', 'delivered', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ message: 'Statut invalide' });
    }

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ message: 'Commande non trouvée' });
    }

    // Vérifier que l'utilisateur est propriétaire de la commande
    if (order.userId !== req.user.userId) {
      return res.status(403).json({ message: 'Accès non autorisé' });
    }

    // Vérifier les transitions de statut valides
    if (order.status === 'cancelled') {
      return res.status(400).json({ message: 'Impossible de modifier une commande annulée' });
    }

    if (order.status === 'delivered' && status !== 'delivered') {
      return res.status(400).json({ message: 'Impossible de modifier une commande livrée' });
    }

    order.status = status;
    await order.save();

    res.json(order);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Annuler une commande
export const cancelOrder = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ message: 'Commande non trouvée' });
    }

    if (order.userId !== req.user.userId) {
      return res.status(403).json({ message: 'Accès non autorisé' });
    }

    if (['delivered', 'cancelled'].includes(order.status)) {
      return res.status(400).json({
        message: 'Impossible d\'annuler une commande livrée ou déjà annulée'
      });
    }

    order.status = 'cancelled';
    await order.save();

    const productService = process.env.VITE_PRODUCT_SERVICE_URL || 'http://product-service:3000';

    // Utiliser Promise.all pour gérer toutes les mises à jour en parallèle
    await Promise.all(order.products.map(async (item) => {
      try {
        await axios.patch(`${productService}/api/products/${item.productId}/stock`, {
          quantity: item.quantity,
          operation: 'increment'
        });
      } catch (error) {
        // Log l'erreur mais ne pas bloquer la réponse
        console.error(`Erreur lors de la mise à jour du stock pour ${item.productId}:`, error);
      }
    }));

    res.json(order);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
