import express from 'express';
import Cart from '../models/cart.js';
import Product from '../models/product.js';

const router = express.Router();

// Obtenir le panier de l'utilisateur
router.get('/', async (req, res) => {
  try {
    const userId = req.headers.userid; // Envoyé depuis le frontend
    let cart = await Cart.findOne({ userId }).populate('items.productId');
    
    if (!cart) {
      cart = new Cart({ userId, items: [] });
      await cart.save();
    }
    
    res.json(cart);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Ajouter un produit au panier
router.post('/add', async (req, res) => {
  try {
    const { userId, productId } = req.body;
    let cart = await Cart.findOne({ userId });
    
    if (!cart) {
      cart = new Cart({ userId, items: [] });
    }

    const existingItem = cart.items.find(item => 
      item.productId.toString() === productId
    );

    if (existingItem) {
      existingItem.quantity += 1;
    } else {
      cart.items.push({ productId, quantity: 1 });
    }

    await cart.save();
    cart = await cart.populate('items.productId');
    
    res.json(cart);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Supprimer un produit du panier
router.delete('/remove/:productId', async (req, res) => {
  try {
    const userId = req.headers.userid;
    const productId = req.params.productId;
    
    const cart = await Cart.findOne({ userId });
    if (!cart) {
      return res.status(404).json({ message: 'Panier non trouvé' });
    }

    cart.items = cart.items.filter(item => 
      item.productId.toString() !== productId
    );
    
    await cart.save();
    await cart.populate('items.productId');
    
    res.json(cart);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;