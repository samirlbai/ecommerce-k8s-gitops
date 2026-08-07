import request from 'supertest';
import mongoose from 'mongoose';
import app from '../src/app.js';
import Product from '../src/models/product.js';

describe('Product API', () => {
  const sampleProduct = {
    name: 'Test Product',
    price: 99.99,
    description: 'Test Description',
    stock: 10
  };

  describe('POST /api/products', () => {
    it('should create a new product', async () => {
      const res = await request(app)
        .post('/api/products')
        .send(sampleProduct);
      
      expect(res.statusCode).toBe(201);
      expect(res.body.name).toBe(sampleProduct.name);
    });
  });

  describe('GET /api/products', () => {
    it('should return all products', async () => {
      await Product.create(sampleProduct);

      const res = await request(app).get('/api/products');
      
      expect(res.statusCode).toBe(200);
      expect(Array.isArray(res.body)).toBeTruthy();
      expect(res.body.length).toBe(1);
    });
  });

  describe('GET /api/products/:id', () => {
    it('should return a product by id', async () => {
      const product = await Product.create(sampleProduct);

      const res = await request(app).get(`/api/products/${product._id}`);
      
      expect(res.statusCode).toBe(200);
      expect(res.body.name).toBe(sampleProduct.name);
    });
  });
});