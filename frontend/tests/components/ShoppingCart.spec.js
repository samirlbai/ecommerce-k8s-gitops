// tests/components/ShoppingCart.spec.js
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import ShoppingCart from '../../src/components/ShoppingCart.vue'
import { createRouter, createWebHistory } from 'vue-router'

describe('ShoppingCart', () => {
  // Création d'un routeur vide pour éviter les avertissements
  const router = createRouter({
    history: createWebHistory(),
    routes: []
  })

  it('affiche un panier vide par défaut', () => {
    const wrapper = mount(ShoppingCart, {
      props: {
        cartItems: []
      },
      global: {
        plugins: [router]
      }
    })
    expect(wrapper.text()).toContain('Votre panier est vide')
  })

  it('calcule correctement le total du panier', () => {
    const cartItems = [
      {
        productId: { _id: 1, name: 'Produit 1', price: 100 },
        quantity: 1
      },
      {
        productId: { _id: 2, name: 'Produit 2', price: 200 },
        quantity: 1
      }
    ]
    const wrapper = mount(ShoppingCart, {
      props: {
        cartItems
      },
      global: {
        plugins: [router]
      }
    })
    expect(wrapper.text()).toContain('Total: 300.00 €')
  })

  it('émet un événement remove-from-cart lors du clic sur le bouton supprimer', async () => {
    const cartItems = [
      {
        productId: { _id: 1, name: 'Produit 1', price: 100 },
        quantity: 1
      }
    ]
    const wrapper = mount(ShoppingCart, {
      props: {
        cartItems
      },
      global: {
        plugins: [router]
      }
    })
    
    await wrapper.find('.remove-item').trigger('click')
    expect(wrapper.emitted('remove-from-cart')).toBeTruthy()
    expect(wrapper.emitted('remove-from-cart')[0]).toEqual([1])
  })
})
