import { jest, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { MongoMemoryServer } from 'mongodb-memory-server-core';
import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.test' });

let mongod;

beforeAll(async () => {
  // Déconnexion si déjà connecté
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }

  mongod = await MongoMemoryServer.create({
    binary: {
      version: '4.4.18',
      skipMD5: true
    },
    instance: {
      storageEngine: 'wiredTiger'
    }
  });

  const uri = await mongod.getUri();
  await mongoose.connect(uri);
});

afterAll(async () => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  if (mongod) {
    await mongod.stop();
  }
});

beforeEach(async () => {
  if (!mongod || !mongod.isRunning) return;
  
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany();
  }
});