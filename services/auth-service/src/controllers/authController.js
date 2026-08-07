import jwt from 'jsonwebtoken';
import User from '../models/user.js';
export const register = async (req, res) => {
    try {
      const { email, password } = req.body;
  
      // Validation de l'email avec une regex plus stricte
      const emailRegex = /^[\w-]+(\.[\w-]+)*@([\w-]+\.)+[a-zA-Z]{2,7}$/;
      if (!email || !emailRegex.test(email)) {
        return res.status(400).json({ message: 'Format d\'email invalide' });
      }
  
      // Validation du mot de passe
      if (!password || password.length < 6) {
        return res.status(400).json({ 
          message: 'Le mot de passe doit contenir au moins 6 caractères' 
        });
      }
  
      // Vérification de l'existence de l'utilisateur
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        return res.status(400).json({ message: 'Email déjà utilisé' });
      }
  
      // Création de l'utilisateur
      const user = new User({ email, password });
  
      // Validation explicite avant la sauvegarde
      try {
        await user.validate();
      } catch (validationError) {
        return res.status(400).json({ 
          message: Object.values(validationError.errors)
            .map(err => err.message)
            .join(', ') 
        });
      }
  
      await user.save();
  
      const token = jwt.sign(
        { userId: user._id, email: user.email },
        process.env.JWT_SECRET || 'test_secret',
        { expiresIn: '24h' }
      );
  
      res.status(201).json({
        message: 'Utilisateur créé avec succès',
        token,
        userId: user._id.toString()
      });
    } catch (error) {
      if (error.name === 'ValidationError') {
        return res.status(400).json({ 
          message: Object.values(error.errors)
            .map(err => err.message)
            .join(', ')
        });
      }
      res.status(500).json({ message: error.message });
    }
  };

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validation des champs requis
    if (!email || !password) {
      return res.status(400).json({ message: 'Email et mot de passe requis' });
    }

    // Recherche de l'utilisateur
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ message: 'Email ou mot de passe incorrect' });
    }

    // Vérification du mot de passe
    const isValidPassword = await user.comparePassword(password);
    if (!isValidPassword) {
      return res.status(401).json({ message: 'Email ou mot de passe incorrect' });
    }

    // Génération du token
    const token = jwt.sign(
      { userId: user._id, email: user.email },
      process.env.JWT_SECRET || 'test_secret',
      { expiresIn: '24h' }
    );

    res.json({ 
      token, 
      userId: user._id.toString(),
      email: user.email
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getProfile = async (req, res) => {
  try {
    // Vérification de l'existence de l'utilisateur
    const user = await User.findById(req.user.userId).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'Utilisateur non trouvé' });
    }

    // Conversion de l'ID en string pour la comparaison dans les tests
    const userObject = user.toObject();
    userObject._id = userObject._id.toString();

    res.json(userObject);
  } catch (error) {
    if (error.name === 'CastError') {
      return res.status(400).json({ message: 'ID utilisateur invalide' });
    }
    res.status(500).json({ message: error.message });
  }
};

// Fonction utilitaire pour la validation d'email (optionnelle)
const isValidEmail = (email) => {
  const emailRegex = /^[\w-]+(\.[\w-]+)*@([\w-]+\.)+[a-zA-Z]{2,7}$/;
  return emailRegex.test(email);
};