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
    if (process.env.NODE_ENV !== 'test') {
      process.exit(1);
    }
  }
};