import { ApolloLink, toPromise, Observable } from 'apollo-link'
import { ApolloClient } from 'apollo-client'
import storage from 'localStorage'
import { InStorageCache, DepTrackingStorageCache } from 'apollo-cache-instorage'

import getFixtures from './fixtures'

const { toObject } = DepTrackingStorageCache
const dataIdFromObject = ({ __typename, id }) => `${__typename}:${id}`

describe('Cache', () => {
  let network, link, fixtures

  const createCache = (config, initial) =>
    new InStorageCache({ dataIdFromObject, storage, ...config }).restore(
      initial || {}
    )

  beforeEach(() => {
    storage.clear()
    fixtures = getFixtures()
    network = jest.fn(() => Observable.of(fixtures.results.simple))
    link = new ApolloLink(network)
  })

  describe('default inMemoryCache behavior', () => {
    it('should touch network when resource not cached', async () => {
      const cache = createCache()
      const client = new ApolloClient({ link, cache })
      const query = fixtures.queries.simple

      const result = await toPromise(client.watchQuery({ query }))

      expect(network).toHaveBeenCalledTimes(1)
      expect(result).toHaveProperty('data.field', 'simple value')
    })

    it('should not touch network when initial value provided', async () => {
      const initial = { ROOT_QUERY: { field: 'simple value' } }
      const cache = createCache(null, initial)
      const client = new ApolloClient({ link, cache })
      const query = fixtures.queries.simple

      const result = await toPromise(client.watchQuery({ query }))

      expect(network).not.toHaveBeenCalled()
      expect(result).toHaveProperty('data.field', 'simple value')
    })

    it('should not touch network when value already cached', async () => {
      const cache = createCache()
      const client = new ApolloClient({ link, cache })
      const query = fixtures.queries.simple

      const first = await toPromise(client.watchQuery({ query }))
      const second = await toPromise(client.watchQuery({ query }))

      expect(network).toHaveBeenCalledTimes(1)
      expect(first).toHaveProperty('data.field', 'simple value')
      expect(second).toHaveProperty('data.field', 'simple value')
    })
  })

  describe('constructor', () => {
    it('should throw when no storage providade', () => {
      expect(() => new InStorageCache()).toThrow('must provide a storage')
    })
  })

  describe('storage', () => {
    it('should persist data to the storage', async () => {
      const cache = createCache()
      const client = new ApolloClient({ link, cache })
      const query = fixtures.queries.simple

      await toPromise(client.watchQuery({ query }))

      expect(toObject(storage)).toEqual({
        ROOT_QUERY: { field: 'simple value' }
      })
      expect(network).toHaveBeenCalledTimes(1)
    })
  })
})
