<template>
  <div class="product-list">
    <h2>Nos Produits</h2>
    <div class="products-grid">
      <div v-for="product in products" 
           :key="product._id" 
           class="product-card">
        <h3>{{ product.name }}</h3>
        <p class="price">{{ product.price }} €</p>
        <p class="description">{{ product.description }}</p>
        <button 
          @click="handleAddToCart(product)" 
          class="add-to-cart"
          :disabled="isAddingToCart"
        >
          {{ isAddingToCart ? 'Ajout...' : 'Ajouter au panier' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, onMounted } from 'vue';
import { productService } from '../services/productService';
import { cartService } from '../services/cartService';

export default {
  name: 'ProductList',
  props: {
    products: {
      type: Array,
      required: true
    }
  },
  emits: ['add-to-cart'],
  setup(props, { emit }) {
    const isAddingToCart = ref(false);

    const handleAddToCart = async (product) => {
      try {
        isAddingToCart.value = true;
        emit('add-to-cart', product);
      } catch (error) {
        console.error('Erreur lors de l\'ajout au panier:', error);
      } finally {
        isAddingToCart.value = false;
      }
    };

    return {
      handleAddToCart,
      isAddingToCart
    };
  }
};
</script>

<style scoped>
.product-list {
  padding: 1rem;
}

.products-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 1rem;
}

.product-card {
  border: 1px solid #ddd;
  border-radius: 8px;
  padding: 1rem;
  background: white;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.price {
  color: #42b983;
  font-weight: bold;
  font-size: 1.2rem;
  margin: 0.5rem 0;
}

.add-to-cart {
  background: #42b983;
  color: white;
  border: none;
  padding: 0.5rem 1rem;
  border-radius: 4px;
  cursor: pointer;
  width: 100%;
  transition: background-color 0.3s;
}

.add-to-cart:hover:not(:disabled) {
  background: #3aa876;
}

.add-to-cart:disabled {
  background: #ccc;
  cursor: not-allowed;
}

.description {
  color: #666;
  margin: 0.5rem 0;
}
</style>