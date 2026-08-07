<template>
  <div id="app">
    <header class="header">
      <h1>E-TryHard</h1>
      <nav class="nav" v-if="isAuthenticated">
        <router-link to="/" class="nav-link">Produits</router-link>
        <router-link to="/cart" class="nav-link">
          Panier ({{ cartCount }})
        </router-link>
        <router-link to="/orders" class="nav-link">Commandes</router-link>
        <button @click="logout" class="logout-btn">Déconnexion</button>
      </nav>
    </header>

    <main class="container">
      <!-- Afficher AuthTest si non authentifié -->
      <div v-if="!isAuthenticated" class="auth-container">
        <AuthTest @login-success="handleLoginSuccess" />
      </div>
      
      <!-- Afficher le contenu principal si authentifié -->
      <router-view v-else
        :key="$route.fullPath"
        :products="products"
        :cart-items="cartItems"
        @add-to-cart="addToCart"
        @remove-from-cart="removeFromCart"
        @cart-cleared="handleCartCleared"
      />
    </main>
  </div>
</template>

<script>
import { ref, onMounted } from 'vue'
import axios from 'axios'
import { useRouter } from 'vue-router'
import AuthTest from './components/AuthTest.vue'

export default {
  name: 'App',
  components: {
    AuthTest
  },
  setup() {
    const router = useRouter()
    const products = ref([])
    const cartItems = ref([])
    const cartCount = ref(0)
    const isAuthenticated = ref(false)

    // Charger les produits depuis l'API
    const loadProducts = async () => {
      try {
        const token = localStorage.getItem('token')
        const response = await axios.get('/api/products', {
          headers: {
            Authorization: `Bearer ${token}`
          }
        })
        products.value = response.data
      } catch (error) {
        console.error('Erreur chargement produits:', error)
      }
    }

    // Charger le panier depuis l'API
    const loadCart = async () => {
      try {
        const token = localStorage.getItem('token')
        const userId = localStorage.getItem('userId')
        if (!token || !userId) return

        const response = await axios.get('/api/cart', {
          headers: { 
            Authorization: `Bearer ${token}`,
            userId: userId
          }
        })
        cartItems.value = response.data.items
        cartCount.value = cartItems.value.length
      } catch (error) {
        console.error('Erreur chargement panier:', error)
      }
    }

    // Ajouter au panier
    const addToCart = async (product) => {
      try {
    const token = localStorage.getItem('token')
    const userId = localStorage.getItem('userId')
    
    console.log('Adding to cart:', product); // Debug log

    await axios.post('/api/cart/add', {
      userId,
      productId: product._id
    }, {
      headers: {
        Authorization: `Bearer ${token}`,
        userId: userId,
        'Content-Type': 'application/json'
      }
    });
    
    // Recharger le panier après l'ajout
    await loadCart();
  } catch (error) {
    console.error('Erreur ajout au panier:', error)
  }
}
    // Supprimer du panier
    const removeFromCart = async (productId) => {
      try {
        const token = localStorage.getItem('token')
        const userId = localStorage.getItem('userId')
        await axios.delete(`/api/cart/remove/${productId}`, {
          headers: { 
            Authorization: `Bearer ${token}`,
            userId: userId
          }
        })
        await loadCart()
      } catch (error) {
        console.error('Erreur suppression du panier:', error)
      }
    }

    // Gérer le nettoyage du panier après une commande
    const handleCartCleared = async () => {
      cartItems.value = []
      cartCount.value = 0
      await loadCart() // Recharger le panier depuis le serveur
    }

    // Gérer la connexion réussie
    const handleLoginSuccess = () => {
      isAuthenticated.value = true
      loadProducts()
      loadCart()
      router.push('/')
    }

    // Gérer la déconnexion
    const logout = () => {
      localStorage.removeItem('token')
      localStorage.removeItem('userId')
      isAuthenticated.value = false
      cartItems.value = []
      cartCount.value = 0
      router.push('/')
    }

    // Vérifier l'authentification au chargement
    const checkAuth = () => {
      const token = localStorage.getItem('token')
      const userId = localStorage.getItem('userId')
      if (token && userId) {
        isAuthenticated.value = true
        loadProducts()
        loadCart()
      }
    }

    // Recharger les produits quand on revient sur la page
    router.beforeEach((to, from, next) => {
      if (to.path === '/' && isAuthenticated.value) {
        loadProducts()
      }
      next()
    })

    onMounted(() => {
      checkAuth()
    })

    return {
      products,
      cartItems,
      cartCount,
      isAuthenticated,
      handleLoginSuccess,
      logout,
      addToCart,
      removeFromCart,
      handleCartCleared
    }
  }
}
</script>

<style>
.header {
  background: #2c3e50;
  color: white;
  padding: 1rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.nav {
  display: flex;
  gap: 1rem;
  align-items: center;
}

.nav-link {
  color: white;
  text-decoration: none;
  padding: 0.5rem 1rem;
  border-radius: 4px;
}

.nav-link:hover {
  background: rgba(255, 255, 255, 0.1);
}

.nav-link.router-link-active {
  background: #42b983;
}

.cart-count {
  background: #42b983;
  padding: 0.5rem 1rem;
  border-radius: 4px;
}

.logout-btn {
  background: #e74c3c;
  color: white;
  border: none;
  padding: 0.5rem 1rem;
  border-radius: 4px;
  cursor: pointer;
}

.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 1rem;
}

.auth-container {
  max-width: 400px;
  margin: 2rem auto;
}

.main-content {
  display: grid;
  grid-template-columns: 3fr 1fr;
  gap: 2rem;
}
</style>