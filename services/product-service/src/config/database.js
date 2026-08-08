// Fichier: src/config/database.js
import mongoose from 'mongoose';

export const connectDB = async () => {
  try {
    // Ne pas se connecter si déjà connecté ou en mode test
    if (mongoose.connection.readyState !== 0 || process.env.NODE_ENV === 'test') {
      console.log('MongoDB déjà connecté ou en mode test');
      return;
    }

    const conn = await mongoose.connect(process.env.MONGODB_URI);
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`Error: ${error.message}`);
    // Aligné sur auth-service/order-service : on quitte pour laisser K8s redémarrer le pod (restartPolicy)
    if (process.env.NODE_ENV !== 'test') {
      process.exit(1);
    }
  }
};
