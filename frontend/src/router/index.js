import { createRouter, createWebHistory } from 'vue-router'
import ProductList from '../components/ProductList.vue'
import ShoppingCart from '../components/ShoppingCart.vue'
import OrderHistory from '../components/OrderHistory.vue'
import AuthTest from '../components/AuthTest.vue'

const routes = [
  {
    path: '/',
    name: 'Home',
    component: ProductList,
    props: true
  },
  {
    path: '/cart',
    name: 'Cart',
    component: ShoppingCart,
    props: true
  },
  {
    path: '/orders',
    name: 'Orders',
    component: OrderHistory,
    props: true
  },
  {
    path: '/auth',
    name: 'Auth',
    component: AuthTest,
    props: true
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

// Navigation guard
router.beforeEach((to, from, next) => {
  const isAuthenticated = localStorage.getItem('token')
  if (to.name !== 'Auth' && !isAuthenticated) {
    next({ name: 'Auth' })
  } else {
    next()
  }
})

export default router