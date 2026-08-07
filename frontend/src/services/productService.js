import axios from 'axios';

const API_URL = import.meta.env.VITE_PRODUCT_SERVICE_URL || '/api';

export const productService = {
  async getProducts() {
    try {
      console.log('Fetching products from:', `${API_URL}/products`);
      const response = await axios.get(`${API_URL}/products`);
      console.log('Products received:', response.data);
      return response.data;
    } catch (error) {
      console.error('Error fetching products:', error);
      throw error;
    }
  },
};
