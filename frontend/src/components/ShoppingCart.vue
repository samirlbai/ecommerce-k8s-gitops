<template>
  <div class="cart">
    <h2>Panier</h2>
    <div v-if="cartItems.length === 0" class="empty-cart">
      Votre panier est vide
    </div>
    <div v-else class="cart-items">
      <div
        v-for="(item, index) in cartItems"
        :key="item.productId ? item.productId._id : index"
        class="cart-item"
      >
        <span>{{ item.productId ? item.productId.name : 'Produit inconnu' }}</span>
        <span>
          {{ item.productId ? item.productId.price : 'N/A' }} € x {{ item.quantity }}
        </span>
        <button
          v-if="item.productId"
          @click="handleRemoveItem(item.productId._id)"
          class="remove-item"
        >
          ×
        </button>
      </div>
      <div class="cart-total">
        Total: {{ total }} €
      </div>
      <div class="checkout-section">
        <div class="shipping-address" v-if="showAddressForm">
          <h3>Adresse de livraison</h3>
          <input
            v-model="shippingAddress.street"
            placeholder="Rue"
            class="address-input"
          />
          <input
            v-model="shippingAddress.city"
            placeholder="Ville"
            class="address-input"
          />
          <input
            v-model="shippingAddress.postalCode"
            placeholder="Code postal"
            class="address-input"
          />
        </div>
        <button
          v-if="!showAddressForm"
          @click="showAddressForm = true"
          class="checkout-btn"
        >
          Passer la commande
        </button>
        <button
          v-else
          @click="checkout"
          class="checkout-btn"
          :disabled="processing || !isAddressValid"
        >
          {{ processing ? 'Traitement...' : 'Confirmer la commande' }}
        </button>
      </div>
      <div v-if="error" class="error-message">
        {{ error }}
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed } from 'vue';
import { useRouter } from 'vue-router';
import axios from 'axios';

export default {
  name: 'ShoppingCart',
  props: {
    cartItems: {
      type: Array,
      required: true,
      default: () => [],
    },
  },
  emits: ['remove-from-cart', 'cart-cleared'],

  setup(props, { emit }) {
    const router = useRouter();
    const processing = ref(false);
    const error = ref('');
    const showAddressForm = ref(false);
    const shippingAddress = ref({
      street: '',
      city: '',
      postalCode: '',
    });

    // Log pour débogage
    console.log('cartItems:', props.cartItems);

    const total = computed(() => {
      return props.cartItems.reduce((sum, item) => {
        return sum + (item.productId ? item.productId.price * item.quantity : 0);
      }, 0).toFixed(2);
    });

    const isAddressValid = computed(() => {
      return (
        shippingAddress.value.street.length > 0 &&
        shippingAddress.value.city.length > 0 &&
        shippingAddress.value.postalCode.length > 0
      );
    });

    const handleRemoveItem = (productId) => {
      emit('remove-from-cart', productId);
    };

    const checkout = async () => {
      if (!isAddressValid.value) {
        error.value = 'Veuillez remplir tous les champs de l\'adresse';
        return;
      }

      try {
        processing.value = true;
        error.value = '';
        const token = localStorage.getItem('token');

        const orderData = {
          products: props.cartItems
            .filter((item) => item.productId) // S'assurer que productId existe
            .map((item) => ({
              productId: item.productId._id,
              quantity: item.quantity,
            })),
          shippingAddress: shippingAddress.value,
        };

        await axios.post('/api/orders', orderData, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        emit('cart-cleared');
        router.push('/orders');
      } catch (err) {
        console.error('Erreur lors de la commande:', err);
        error.value = 'Erreur lors de la création de la commande. Veuillez réessayer.';
      } finally {
        processing.value = false;
      }
    };

    return {
      total,
      checkout,
      processing,
      error,
      showAddressForm,
      shippingAddress,
      isAddressValid,
      handleRemoveItem,
    };
  },
};
</script>

<style scoped>
.cart {
  background: #f8f9fa;
  padding: 1rem;
  border-radius: 8px;
}

.cart-items {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.cart-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.5rem;
  background: white;
  border-radius: 4px;
}

.remove-item {
  background: #dc3545;
  color: white;
  border: none;
  border-radius: 50%;
  width: 24px;
  height: 24px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
}

.remove-item:hover {
  background: #c82333;
}

.cart-total {
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px solid #ddd;
  font-weight: bold;
  text-align: right;
}

.empty-cart {
  text-align: center;
  color: #6c757d;
  padding: 1rem;
}

.checkout-section {
  margin-top: 1rem;
}

.shipping-address {
  margin: 1rem 0;
  padding: 1rem;
  background: white;
  border-radius: 4px;
}

.address-input {
  width: 100%;
  padding: 0.5rem;
  margin: 0.5rem 0;
  border: 1px solid #ddd;
  border-radius: 4px;
}

.checkout-btn {
  width: 100%;
  padding: 1rem;
  background: #42b983;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 1rem;
  margin-top: 1rem;
}

.checkout-btn:disabled {
  background: #cccccc;
  cursor: not-allowed;
}

.error-message {
  color: #dc3545;
  margin-top: 1rem;
  text-align: center;
  padding: 0.5rem;
  background: #ffe6e6;
  border-radius: 4px;
}

h3 {
  margin: 0 0 1rem 0;
  color: #2c3e50;
}
</style>
