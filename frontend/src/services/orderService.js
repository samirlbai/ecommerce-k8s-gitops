import axios from 'axios';

export const orderService = {
  // Récupérer toutes les commandes
  getOrders: async () => {
    const token = localStorage.getItem('token');
    const response = await axios.get('/api/orders', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    return response.data;
  },

  // Créer une nouvelle commande
  createOrder: async (orderData) => {
    const token = localStorage.getItem('token');
    const response = await axios.post('/api/orders', orderData, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    return response.data;
  },

  // Mettre à jour le statut d'une commande
  updateOrderStatus: async (orderId, status) => {
    const token = localStorage.getItem('token');
    const response = await axios.patch(
      `/api/orders/${orderId}/status`,
      { status },
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );
    return response.data;
  },
};
