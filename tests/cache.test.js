/* eslint-disable no-debugger */
import { ApolloLink, toPromise, Observable, createOperation } from 'apollo-link'
import { ApolloClient } from 'apollo-client'
import gql from 'graphql-tag'
import storage from 'localStorage'
import { InStorageCache, DepTrackingStorageCache } from 'apollo-cache-instorage'

const { toObject, normalize, denormalize } = DepTrackingStorageCache

const dataIdFromObject = ({ __typename, id }) =>
  id ? `${__typename}:${id}` : undefined

// prettier-ignore
const queries = {
  simple: gql`query simple { field }`,
  typed: gql`query typed { typeField { field } }`,
  identified: gql`query identified { identified { id field } }`,
  all: gql`query all { field typeField { field } identified { id field } }`
}

const variables = {}
const extensions = {}

// prettier-ignore
const operations = {
  simple: createOperation({}, { query: queries.simple, variables, extensions }),
  typed: createOperation({}, { query: queries.typed, variables, extensions }),
  identified: createOperation({}, { query: queries.identified, variables, extensions })
}

// Fulfil operation names.
for (let i in operations) {
  operations[i].operationName = operations[i].query.definitions.find(
    ({ kind }) => kind === 'OperationDefinition'
  ).name.value
}

// prettier-ignore
const results = {
  simple: { data: { field: 'simple value' } },
  typed: { data: { typeField: { field: 'value', __typename: 'TypeName' } } },
  identified: { data: { identified: { id: 'string', field: 'value', __typename: 'IdentifiedType' } } },
  all: { data: {
    field: 'simple value',
    typeField: { field: 'value', __typename: 'TypeName' },
    identified: { id: 'identification', field: 'value', __typename: 'IdentifiedType' } }
  }
}

describe('Cache', () => {
  let network, link

  const createCache = (config, initial) =>
    new InStorageCache({ dataIdFromObject, storage, ...config }).restore(
      initial || {}
    )

  beforeEach(() => {
    storage.clear()
    network = jest.fn(({ operationName }) =>
      Observable.of(results[operationName])
    )
    link = new ApolloLink(network)
  })

  describe('default InMemoryCache behavior', () => {
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
    describe('root', () => {
      it('should fetch and persist root data to the storage', async () => {
        const cache = createCache()
        const client = new ApolloClient({ link, cache })
        const query = queries.simple

        await toPromise(client.watchQuery({ query }))

        expect(network).toHaveBeenCalledTimes(1)
        expect(toObject(storage)).toEqual({
          ROOT_QUERY: { field: 'simple value' }
        })
      })

      it('should retrieve root persisted data from the storage', async () => {
        const cache = createCache()
        const client = new ApolloClient({ link, cache })
        const query = queries.simple

        storage.setItem('ROOT_QUERY', normalize({ field: 'simple value' }))

        const result = await toPromise(client.watchQuery({ query }))

        expect(network).not.toHaveBeenCalled()
        expect(result.data).toEqual(results.simple.data)
      })

      it('should retrieve root persisted data on new client', async () => {
        let cache, client
        const query = queries.simple

        cache = createCache({ storage })
        client = new ApolloClient({ link, cache })

        const first = await toPromise(client.watchQuery({ query }))

        expect(network).toHaveBeenCalledTimes(1)
        expect(first.data).toEqual(results.simple.data)
        expect(denormalize(storage.getItem('ROOT_QUERY'))).toEqual({
          field: 'simple value'
        })

        cache = createCache({ storage })
        client = new ApolloClient({ link, cache })

        const second = await toPromise(client.watchQuery({ query }))

        expect(network).toHaveBeenCalledTimes(1)
        expect(second.data).toEqual(results.simple.data)
      })
    })

    describe('non-id type', () => {
      it('should fetch and persist type data to the storage', async () => {
        const cache = createCache()
        const client = new ApolloClient({ link, cache })
        const query = queries.typed

        await toPromise(client.watchQuery({ query }))

        expect(network).toHaveBeenCalledTimes(1)

        expect(toObject(storage)).toEqual({
          '$ROOT_QUERY.typeField': {
            __typename: 'TypeName',
            field: 'value'
          },
          ROOT_QUERY: {
            typeField: {
              generated: true,
              id: '$ROOT_QUERY.typeField',
              type: 'id',
              typename: 'TypeName'
            }
          }
        })
      })

      it('should retrieve type persisted data from the storage', async () => {
        const cache = createCache()
        const client = new ApolloClient({ link, cache })
        const query = queries.typed

        storage.setItem(
          '$ROOT_QUERY.typeField',
          normalize({
            __typename: 'TypeName',
            field: 'value'
          })
        )

        storage.setItem(
          'ROOT_QUERY',
          normalize({
            typeField: {
              generated: true,
              id: '$ROOT_QUERY.typeField',
              type: 'id',
              typename: 'TypeName'
            }
          })
        )

        const result = await toPromise(client.watchQuery({ query }))

        expect(network).not.toHaveBeenCalled()
        expect(result.data).toEqual(results.typed.data)
      })

      it('should retrieve type persisted data on new client', async () => {
        let cache, client
        const query = queries.typed

        cache = createCache({ storage })
        client = new ApolloClient({ link, cache })

        const first = await toPromise(client.watchQuery({ query }))

        expect(network).toHaveBeenCalledTimes(1)
        expect(first.data).toEqual(results.typed.data)
        expect(denormalize(storage.getItem('$ROOT_QUERY.typeField'))).toEqual({
          field: 'value',
          __typename: 'TypeName'
        })

        cache = createCache({ storage })
        client = new ApolloClient({ link, cache })

        const second = await toPromise(client.watchQuery({ query }))

        expect(network).toHaveBeenCalledTimes(1)
        expect(second.data).toEqual(results.typed.data)
      })

      it('should fetch and persist type data when missing field', async () => {
        const cache = createCache()
        const client = new ApolloClient({ link, cache })

        // Dispatch first query to fulfil ROOT_QUERY in storage.
        await toPromise(client.watchQuery({ query: queries.simple }))
        expect(network).toHaveBeenCalledTimes(1)

        await toPromise(client.watchQuery({ query: queries.typed }))
        expect(network).toHaveBeenCalledTimes(2)

        expect(toObject(storage)).toEqual({
          '$ROOT_QUERY.typeField': {
            __typename: 'TypeName',
            field: 'value'
          },
          ROOT_QUERY: {
            field: 'simple value',
            typeField: {
              generated: true,
              id: '$ROOT_QUERY.typeField',
              type: 'id',
              typename: 'TypeName'
            }
          }
        })
      })
    })
  })

  describe('shouldPersist', () => {
    it('should be possible avoid caching resources', async () => {
      const shouldPersist = (dataId, value) => false
      const cache = createCache({ shouldPersist })
      const client = new ApolloClient({ link, cache })
      const query = queries.typed

      await toPromise(client.watchQuery({ query }))

      expect(network).toHaveBeenCalledTimes(1)
      expect(toObject(storage)).toEqual({})
    })

    it('should be possible to control cached resources', async () => {
      let cache, client

      const shouldPersist = (dataId, value) => dataId === 'ROOT_QUERY'
      cache = createCache({ shouldPersist })
      client = new ApolloClient({ link, cache })

      // Dispatch first query to fulfil data.
      await toPromise(client.watchQuery({ query: queries.all }))
      expect(network).toHaveBeenCalledTimes(1)

      // Renew client and memory cache.
      cache = createCache({ shouldPersist })
      client = new ApolloClient({ link, cache })

      // Dispatch a query that should be cached.
      await toPromise(client.watchQuery({ query: queries.simple }))
      expect(network).toHaveBeenCalledTimes(1)

      // Renew client and memory cache.
      cache = createCache({ shouldPersist })
      client = new ApolloClient({ link, cache })

      // Dispatch a query that should NOT be cached.
      await toPromise(client.watchQuery({ query: queries.typed }))
      expect(network).toHaveBeenCalledTimes(2)
    })
  })

  describe('restore', () => {
    it('should be possible to restore initial data on the cache', () => {
      const initial = { ROOT_QUERY: { field: 'simple value' } }
      createCache().restore(initial)
      expect(toObject(storage)).toEqual(initial)
    })
  })

  describe('fetchPolicy', () => {
    it('should touch network when using cache-and-network fetchPolicy', async () => {
      const query = queries.simple
      const response = { data: { field: 'new value' } }
      const network = jest.fn(({ operationName }) => Observable.of(response))
      const link = new ApolloLink(network)
      const cache = createCache()
      const client = new ApolloClient({ link, cache })
      const fetchPolicy = 'cache-and-network'

      storage.setItem('ROOT_QUERY', normalize({ field: 'simple value' }))

      // `toPromise` make first result return only, so `first` is still stale.
      const first = await toPromise(client.watchQuery({ query, fetchPolicy }))
      expect(network).toHaveBeenCalledTimes(1)
      expect(first.data).toEqual(results.simple.data)
      expect(denormalize(storage.getItem('ROOT_QUERY'))).toEqual(response.data)

      const second = await toPromise(client.watchQuery({ query }))
      expect(network).toHaveBeenCalledTimes(1)
      expect(second.data).toEqual(response.data)
      expect(denormalize(storage.getItem('ROOT_QUERY'))).toEqual(response.data)
    })

    it('should touch network when using network-only fetchPolicy', async () => {
      const query = queries.simple
      const response = { data: { field: 'new value' } }
      const network = jest.fn(({ operationName }) => Observable.of(response))
      const link = new ApolloLink(network)
      const cache = createCache()
      const client = new ApolloClient({ link, cache })
      const fetchPolicy = 'network-only'

      storage.setItem('ROOT_QUERY', normalize({ field: 'simple value' }))

      const result = await toPromise(client.watchQuery({ query, fetchPolicy }))
      expect(network).toHaveBeenCalledTimes(1)
      expect(result.data).toEqual(response.data)
    })

    it('should only touch network when using no-cache fetchPolicy', async () => {
      const query = queries.simple
      const initial = { field: 'simple value' }
      const response = { data: { field: 'new value' } }
      const network = jest.fn(({ operationName }) => Observable.of(response))
      const link = new ApolloLink(network)
      const cache = createCache()
      const client = new ApolloClient({ link, cache })
      const fetchPolicy = 'no-cache'

      storage.setItem('ROOT_QUERY', normalize(initial))

      // `toPromise` make first result return only, so `first` is still stale.
      const first = await toPromise(client.watchQuery({ query, fetchPolicy }))
      expect(network).toHaveBeenCalledTimes(1)
      expect(first.data).toEqual(response.data)
      expect(denormalize(storage.getItem('ROOT_QUERY'))).toEqual(initial)

      const second = await toPromise(client.watchQuery({ query, fetchPolicy }))
      expect(network).toHaveBeenCalledTimes(2)
      expect(second.data).toEqual(response.data)
      expect(denormalize(storage.getItem('ROOT_QUERY'))).toEqual(initial)
    })
  })
})
