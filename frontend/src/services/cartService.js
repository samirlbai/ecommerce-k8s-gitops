import axios from 'axios';

export const cartService = {
  async getCart() {
    const token = localStorage.getItem('token');
    const userId = localStorage.getItem('userId');
    
    const response = await axios.get('/api/cart', {
      headers: {
        Authorization: `Bearer ${token}`,
        userId: userId,
      },
    });
    return response.data;
  },

  async addToCart(productId) {
    const token = localStorage.getItem('token');
    const userId = localStorage.getItem('userId');
    
    const response = await axios.post(
      '/api/cart/add',
      { userId, productId },
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );
    return response.data;
  },

  async removeFromCart(productId) {
    const token = localStorage.getItem('token');
    const userId = localStorage.getItem('userId');
    
    const response = await axios.delete(`/api/cart/remove/${productId}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        userId: userId,
      },
    });
    return response.data;
  },
};
