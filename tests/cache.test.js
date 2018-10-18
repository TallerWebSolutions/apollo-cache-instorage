import { ApolloLink, toPromise, Observable, createOperation } from 'apollo-link'
import { ApolloClient } from 'apollo-client'
import gql from 'graphql-tag'
import storage from 'localStorage'
import { InStorageCache, DepTrackingStorageCache } from 'apollo-cache-instorage'

const { toObject, normalize } = DepTrackingStorageCache
const dataIdFromObject = ({ __typename, id }) => `${__typename}:${id}`

const queries = {
  simple: gql`
    query Simple {
      field
    }
  `
}

const variables = {}
const extensions = {}

const operations = {
  simple: createOperation({}, { query: queries.simple, variables, extensions })
}

// Fulfil operation names.
for (let i in operations) {
  operations[i].operationName = operations[i].query.definitions.find(
    ({ kind }) => kind === 'OperationDefinition'
  ).name.value
}

const results = {
  simple: { data: { field: 'simple value' } }
}

describe('Cache', () => {
  let network, link

  const createCache = (config, initial) =>
    new InStorageCache({ dataIdFromObject, storage, ...config }).restore(
      initial || {}
    )

  beforeEach(() => {
    storage.clear()
    network = jest.fn(() => Observable.of(results.simple))
    link = new ApolloLink(network)
  })

  describe('default inMemoryCache behavior', () => {
    it('should touch network when resource not cached', async () => {
      const cache = createCache()
      const client = new ApolloClient({ link, cache })
      const query = queries.simple

      const result = await toPromise(client.watchQuery({ query }))

      expect(network).toHaveBeenCalledTimes(1)
      expect(result).toHaveProperty('data.field', 'simple value')
    })

    it('should not touch network when initial value provided', async () => {
      const initial = { ROOT_QUERY: { field: 'simple value' } }
      const cache = createCache(null, initial)
      const client = new ApolloClient({ link, cache })
      const query = queries.simple

      const result = await toPromise(client.watchQuery({ query }))

      expect(network).not.toHaveBeenCalled()
      expect(result).toHaveProperty('data.field', 'simple value')
    })

    it('should not touch network when value already cached', async () => {
      const cache = createCache()
      const client = new ApolloClient({ link, cache })
      const query = queries.simple

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
    it('should persist root data to the storage', async () => {
      const cache = createCache()
      const client = new ApolloClient({ link, cache })
      const query = queries.simple

      await toPromise(client.watchQuery({ query }))

      expect(toObject(storage)).toEqual({
        ROOT_QUERY: { field: 'simple value' }
      })
      expect(network).toHaveBeenCalledTimes(1)
    })

    it('should retrieve root persisted data from the storage', async () => {
      const cache = createCache()
      const client = new ApolloClient({ link, cache })
      const query = queries.simple

      storage.setItem('ROOT_QUERY', normalize({ field: 'simple value' }))

      const result = await toPromise(client.watchQuery({ query }))

      expect(toObject(storage)).toEqual({
        ROOT_QUERY: { field: 'simple value' }
      })

      expect(network).not.toHaveBeenCalled()
      expect(result.data).toEqual(results.simple.data)
    })

    it('should persist root data to the storage', async () => {
      const cache = createCache()
      const client = new ApolloClient({ link, cache })
      const query = queries.simple

      await toPromise(client.watchQuery({ query }))

      expect(toObject(storage)).toEqual({
        ROOT_QUERY: { field: 'simple value' }
      })
      expect(network).toHaveBeenCalledTimes(1)
    })
  })
})
