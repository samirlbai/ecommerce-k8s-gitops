import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import ProductList from '../../src/components/ProductList.vue'

describe('ProductList', () => {
  const mockProducts = [
    { id: 1, name: 'Produit 1', price: 99.99, description: 'Description 1' },
    { id: 2, name: 'Produit 2', price: 149.99, description: 'Description 2' }
  ]

  it('affiche correctement la liste des produits', () => {
    const wrapper = mount(ProductList, {
      props: {
        products: mockProducts
      }
    })
    expect(wrapper.findAll('.product-card')).toHaveLength(2)
  })

  it('émet un événement add-to-cart lors du clic sur le bouton ajouter', async () => {
    const wrapper = mount(ProductList, {
      props: {
        products: mockProducts
      }
    })
    
    await wrapper.find('.add-to-cart').trigger('click')
    expect(wrapper.emitted('add-to-cart')).toBeTruthy()
    expect(wrapper.emitted('add-to-cart')[0]).toEqual([mockProducts[0]])
  })

  it('affiche correctement les prix des produits', () => {
    const wrapper = mount(ProductList, {
      props: {
        products: mockProducts
      }
    })
    const prices = wrapper.findAll('.price')
    expect(prices[0].text()).toContain('99.99')
    expect(prices[1].text()).toContain('149.99')
  })
})