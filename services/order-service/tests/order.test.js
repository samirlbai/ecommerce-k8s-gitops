import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import request from 'supertest';
import app from '../src/app.js';
import Order from '../src/models/order.js';
import jwt from 'jsonwebtoken';

// Mock axios correctement


jest.mock('axios');

import axios from 'axios';
const mockAxiosGet = jest.fn();
const mockAxiosPatch = jest.fn();

axios.get = mockAxiosGet;
axios.patch = mockAxiosPatch;

describe('Order Endpoints', () => {
  const testUser = {
    userId: '507f1f77bcf86cd799439011',
    email: 'test@example.com'
  };

  const mockProduct = {
    _id: '507f1f77bcf86cd799439012',
    name: 'Test Product',
    price: 100,
    stock: 10
  };

  const mockToken = jwt.sign(
    { userId: testUser.userId, email: testUser.email },
    process.env.JWT_SECRET || 'efrei_super_pass'
  );

  beforeEach(async () => {
    await Order.deleteMany({});
    jest.clearAllMocks();
    
  // Configuration par défaut des mocks
  mockAxiosGet.mockReset();
  mockAxiosPatch.mockReset();
  });
  describe('POST /api/orders', () => {
    it('should create a new order', async () => {
      const productService = process.env.VITE_PRODUCT_SERVICE_URL || 'http://product-service:3000';

      // Réinitialiser et configurer le mock pour GET
      mockAxiosGet.mockReset();
      mockAxiosGet.mockResolvedValueOnce({
        data: mockProduct
      });

      const orderData = {
        products: [{ 
          productId: mockProduct._id, 
          quantity: 2 
        }],
        shippingAddress: {
          street: '123 Test St',
          city: 'Test City',
          postalCode: '12345'
        }
      };

      const res = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${mockToken}`)
        .send(orderData);

      // Vérifier que le mock a été appelé correctement
      expect(mockAxiosGet).toHaveBeenCalledWith(
        `${productService}/api/products/${mockProduct._id}`
      );
      expect(mockAxiosGet).toHaveBeenCalledTimes(1);

      expect(res.statusCode).toBe(201);
      expect(res.body).toHaveProperty('userId', testUser.userId);
      expect(res.body.totalAmount).toBe(mockProduct.price * orderData.products[0].quantity);
      expect(res.body.status).toBe('pending');
    });

    it('should not create order without products', async () => {
      const orderData = {
        shippingAddress: {
          street: '123 Test St',
          city: 'Test City',
          postalCode: '12345'
        }
      };

      const res = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${mockToken}`)
        .send(orderData);

      expect(res.statusCode).toBe(400);
      expect(res.body.message).toMatch(/produits requis/i);
    });

    it('should not create order with invalid product ID', async () => {
      // Correction du mock pour rejeter la promesse
      mockAxiosGet.mockImplementationOnce(() => Promise.reject(new Error('Product not found')));

      const orderData = {
        products: [{ 
          productId: 'invalid_id', 
          quantity: 1 
        }],
        shippingAddress: {
          street: '123 Test St',
          city: 'Test City',
          postalCode: '12345'
        }
      };

      const res = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${mockToken}`)
        .send(orderData);

      expect(res.statusCode).toBe(400);
      expect(res.body.message).toMatch(/produit non trouvé/i);
    });
});

  describe('GET /api/orders/:id', () => {
    let testOrder;

    beforeEach(async () => {
      testOrder = await Order.create({
        userId: testUser.userId,
        products: [{
          productId: mockProduct._id,
          name: mockProduct.name,
          price: mockProduct.price,
          quantity: 1
        }],
        totalAmount: mockProduct.price,
        shippingAddress: {
          street: '123 Test St',
          city: 'Test City',
          postalCode: '12345'
        }
      });
    });

    it('should get order by id', async () => {
      const res = await request(app)
        .get(`/api/orders/${testOrder._id}`)
        .set('Authorization', `Bearer ${mockToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body._id).toBe(testOrder._id.toString());
    });

    it('should not get order of another user', async () => {
      const otherOrder = await Order.create({
        userId: 'other_user_id',
        products: [{
          productId: mockProduct._id,
          name: mockProduct.name,
          price: mockProduct.price,
          quantity: 1
        }],
        totalAmount: mockProduct.price,
        shippingAddress: {
          street: '123 Test St',
          city: 'Test City',
          postalCode: '12345'
        }
      });

      const res = await request(app)
        .get(`/api/orders/${otherOrder._id}`)
        .set('Authorization', `Bearer ${mockToken}`);

      expect(res.statusCode).toBe(403);
    });
  });

  describe('PATCH /api/orders/:id/status', () => {
    let testOrder;

    beforeEach(async () => {
      testOrder = await Order.create({
        userId: testUser.userId,
        products: [{
          productId: mockProduct._id,
          name: mockProduct.name,
          price: mockProduct.price,
          quantity: 1
        }],
        totalAmount: mockProduct.price,
        status: 'pending',
        shippingAddress: {
          street: '123 Test St',
          city: 'Test City',
          postalCode: '12345'
        }
      });
    });

    it('should update order status', async () => {
      const res = await request(app)
        .patch(`/api/orders/${testOrder._id}/status`)
        .set('Authorization', `Bearer ${mockToken}`)
        .send({ status: 'confirmed' });

      expect(res.statusCode).toBe(200);
      expect(res.body.status).toBe('confirmed');
    });

    it('should not update with invalid status', async () => {
      const res = await request(app)
        .patch(`/api/orders/${testOrder._id}/status`)
        .set('Authorization', `Bearer ${mockToken}`)
        .send({ status: 'invalid_status' });

      expect(res.statusCode).toBe(400);
      expect(res.body.message).toMatch(/statut invalide/i);
    });
  });

  describe('DELETE /api/orders/:id', () => {
    let testOrder;

    beforeEach(async () => {
      testOrder = await Order.create({
        userId: testUser.userId,
        products: [{
          productId: mockProduct._id,
          name: mockProduct.name,
          price: mockProduct.price,
          quantity: 1
        }],
        totalAmount: mockProduct.price,
        status: 'pending',
        shippingAddress: {
          street: '123 Test St',
          city: 'Test City',
          postalCode: '12345'
        }
      });

      // Mock spécifique pour la mise à jour du stock avec PATCH
      mockAxiosPatch.mockReset();
      mockAxiosPatch.mockResolvedValueOnce({
        data: { message: 'Stock updated successfully' }
      });
    });

    it('should cancel order', async () => {
      const res = await request(app)
        .delete(`/api/orders/${testOrder._id}`)
        .set('Authorization', `Bearer ${mockToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.status).toBe('cancelled');
      
      // Vérifier que le patch a bien été appelé
      expect(mockAxiosPatch).toHaveBeenCalledTimes(1);
    });

  
    it('should not cancel delivered order', async () => {
      await Order.findByIdAndUpdate(testOrder._id, { status: 'delivered' });
  
      const res = await request(app)
        .delete(`/api/orders/${testOrder._id}`)
        .set('Authorization', `Bearer ${mockToken}`);
  
      expect(res.statusCode).toBe(400);
      expect(res.body.message).toMatch(/impossible d'annuler/i);
    });
  });
});