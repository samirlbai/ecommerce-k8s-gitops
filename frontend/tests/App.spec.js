// tests/App.spec.js
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import App from '../src/App.vue'
import { createRouter, createWebHistory } from 'vue-router'
import axios from 'axios'

vi.mock('axios')

describe('App', () => {
  let wrapper
  let router

  beforeEach(async () => {
    router = createRouter({
      history: createWebHistory(),
      routes: [
        { path: '/', component: { template: '<div>Home</div>' } }
      ]
    })

    router.push('/')
    await router.isReady()

    // Mock de window.localStorage
    const localStorageMock = {
      getItem: vi.fn((key) => {
        if (key === 'token') return 'test-token'
        if (key === 'userId') return 'test-user-id'
        return null
      }),
      setItem: vi.fn(),
      removeItem: vi.fn()
    }
    Object.defineProperty(window, 'localStorage', {
      value: localStorageMock,
      writable: true
    })

    // Réinitialiser les mocks d'Axios avant chaque test
    axios.post.mockReset()
    axios.get.mockReset()
    axios.delete && axios.delete.mockReset()

    wrapper = mount(App, {
      global: {
        plugins: [router],
        stubs: ['router-link', 'router-view', 'AuthTest']
      }
    })
  })

  it('initialise correctement l\'état du panier', () => {
    expect(wrapper.vm.cartItems).toHaveLength(0)
    expect(wrapper.vm.cartCount).toBe(0)
  })

  it('met à jour correctement le panier lors de l\'ajout d\'un produit', async () => {
    const product = { _id: 1, name: 'Test', price: 100 }
    
    // Mock de l'appel axios.post dans addToCart
    axios.post.mockResolvedValue({ data: { success: true } })

    // Mock de l'appel axios.get dans loadCart
    axios.get.mockResolvedValueOnce({
      data: {
        items: [
          {
            productId: product,
            quantity: 1
          }
        ]
      }
    })

    await wrapper.vm.addToCart(product)
    await flushPromises() // Attendre la résolution des promesses
    expect(wrapper.vm.cartItems).toHaveLength(1)
    expect(wrapper.vm.cartCount).toBe(1)
  })

  it('supprime correctement un produit du panier', async () => {
    const product = { _id: 1, name: 'Test', price: 100 }

    // Mock de l'appel axios.post dans addToCart
    axios.post.mockResolvedValue({ data: { success: true } })

    // Mock de l'appel axios.get dans loadCart après ajout
    axios.get.mockResolvedValueOnce({
      data: {
        items: [
          {
            productId: product,
            quantity: 1
          }
        ]
      }
    })

    await wrapper.vm.addToCart(product)
    await flushPromises()

    // Mock de l'appel axios.delete dans removeFromCart
    axios.delete.mockResolvedValue({ data: { success: true } })

    // Mock de l'appel axios.get dans loadCart après suppression
    axios.get.mockResolvedValueOnce({
      data: {
        items: []
      }
    })

    await wrapper.vm.removeFromCart(1)
    await flushPromises()
    expect(wrapper.vm.cartItems).toHaveLength(0)
    expect(wrapper.vm.cartCount).toBe(0)
  })
})
