<template>
    <div class="orders">
      <h2>Mes Commandes</h2>
      <div v-if="loading" class="loading">Chargement...</div>
      <div v-else-if="error" class="error">{{ error }}</div>
      <div v-else-if="orders.length === 0" class="no-orders">
        Vous n'avez pas encore de commandes
      </div>
      <div v-else class="orders-list">
        <div v-for="order in orders" :key="order._id" class="order-card">
          <div class="order-header">
            <span class="order-id">Commande #{{ order._id.slice(-6) }}</span>
            <span :class="['status', order.status]">{{ translateStatus(order.status) }}</span>
          </div>
          <div class="order-products">
            <div v-for="product in order.products" :key="product._id" class="product-item">
              <span class="product-name">{{ product.name }}</span>
              <span class="product-details">
                {{ product.price }}€ x {{ product.quantity }}
              </span>
            </div>
          </div>
          <div class="order-address">
            <strong>Adresse de livraison:</strong>
            <p>{{ order.shippingAddress.street }}</p>
            <p>{{ order.shippingAddress.city }}, {{ order.shippingAddress.postalCode }}</p>
          </div>
          <div class="order-total">
            Total: {{ order.totalAmount }}€
          </div>
          <div class="order-date">
            Commandé le: {{ formatDate(order.createdAt) }}
          </div>
        </div>
      </div>
    </div>
  </template>
  
  <script>
  import { ref, onMounted } from 'vue';
  import { orderService } from '../services/orderService';
  
  export default {
    name: 'OrderHistory',
    setup() {
      const orders = ref([]);
      const loading = ref(true);
      const error = ref(null);
  
      const translateStatus = (status) => {
        const translations = {
          'pending': 'En attente',
          'confirmed': 'Confirmée',
          'shipped': 'Expédiée',
          'delivered': 'Livrée',
          'cancelled': 'Annulée'
        };
        return translations[status] || status;
      };
  
      const formatDate = (dateString) => {
        return new Date(dateString).toLocaleDateString('fr-FR', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });
      };
  
      const fetchOrders = async () => {
        try {
          loading.value = true;
          orders.value = await orderService.getOrders();
        } catch (err) {
          error.value = 'Erreur lors du chargement des commandes';
          console.error('Erreur:', err);
        } finally {
          loading.value = false;
        }
      };
  
      onMounted(fetchOrders);
  
      return {
        orders,
        loading,
        error,
        translateStatus,
        formatDate
      };
    }
  };
  </script>
  
  <style scoped>
  .orders {
    padding: 20px;
    max-width: 800px;
    margin: 0 auto;
  }
  
  .loading, .error, .no-orders {
    text-align: center;
    padding: 2rem;
    background: #f8f9fa;
    border-radius: 8px;
    margin: 1rem 0;
  }
  
  .error {
    color: #dc3545;
    background: #ffe6e6;
  }
  
  .order-card {
    background: white;
    border: 1px solid #ddd;
    margin-bottom: 15px;
    padding: 20px;
    border-radius: 8px;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  }
  
  .order-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 15px;
    padding-bottom: 10px;
    border-bottom: 1px solid #eee;
  }
  
  .order-id {
    font-weight: bold;
    color: #2c3e50;
  }
  
  .status {
    padding: 6px 12px;
    border-radius: 20px;
    font-size: 0.9em;
    font-weight: 500;
  }
  
  .status.pending { 
    background-color: #fff3cd;
    color: #856404;
  }
  .status.confirmed { 
    background-color: #d4edda;
    color: #155724;
  }
  .status.shipped { 
    background-color: #cce5ff;
    color: #004085;
  }
  .status.delivered { 
    background-color: #90ee90;
    color: #1e4620;
  }
  .status.cancelled { 
    background-color: #f8d7da;
    color: #721c24;
  }
  
  .product-item {
    display: flex;
    justify-content: space-between;
    padding: 8px 0;
    border-bottom: 1px solid #eee;
  }
  
  .product-item:last-child {
    border-bottom: none;
  }
  
  .order-address {
    margin: 15px 0;
    padding: 10px;
    background: #f8f9fa;
    border-radius: 4px;
  }
  
  .order-address p {
    margin: 5px 0;
    color: #666;
  }
  
  .order-total {
    margin-top: 15px;
    font-weight: bold;
    text-align: right;
    font-size: 1.1em;
    color: #2c3e50;
  }
  
  .order-date {
    margin-top: 10px;
    font-size: 0.9em;
    color: #666;
    text-align: right;
  }
  </style>