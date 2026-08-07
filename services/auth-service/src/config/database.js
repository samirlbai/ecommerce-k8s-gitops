import mongoose from 'mongoose';

export const connectDB = async () => {
  try {
    // Ne pas se connecter si déjà connecté
    if (mongoose.connection.readyState !== 0) {
      console.log('MongoDB already connected');
      return;
    }

    const conn = await mongoose.connect(process.env.MONGODB_URI);
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`Error: ${error.message}`);
    // Ne pas quitter le processus en mode test
    if (process.env.NODE_ENV !== 'test') {
      process.exit(1);
    }
  }
};