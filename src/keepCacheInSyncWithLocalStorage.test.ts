import { NormalizedCacheObject, StoreObject } from 'apollo-cache-inmemory'
import { ApolloClient } from 'apollo-client'
import { ApolloLink } from 'apollo-link'

import keepCacheInSyncWithLocalStorage from './keepCacheInSyncWithLocalStorage'
import InStorageCache, { PublicConfig } from './InStorageCache'
import { denormalize, normalize, toObject } from './utils'

const storage = localStorage

const testValue = {
  myKey: 'newValue',
}

describe('keepCacheInSyncWithLocalStorage', () => {
  const defaultPrefix = 'myprefix_'
  const createCache = (
    config: Partial<PublicConfig> = {},
    initial?: NormalizedCacheObject,
  ) =>
    new InStorageCache({
      storage,
      prefix: defaultPrefix,
      ...config,
    }).restore(initial || {})
  const createStorageEvent = (
    dataId: string,
    value: StoreObject | null,
    prefix = defaultPrefix,
  ) =>
    new StorageEvent('storage', {
      key: `${prefix}${dataId}`,
      newValue: value === null ? null : normalize(value, dataId),
    })
  let link!: ApolloLink

  beforeEach(() => {
    storage.clear()
    link = new ApolloLink()
  })

  describe('Standard config', () => {
    let cache!: InStorageCache
    let client!: ApolloClient<{}>
    let removeEventListeners!: () => void
    beforeEach(() => {
      cache = createCache()
      client = new ApolloClient({ link, cache })
      cache.broadcastWatches = jest.fn()
      client.queryManager.broadcastQueries = jest.fn()
      removeEventListeners = keepCacheInSyncWithLocalStorage(cache, client)
    })
    afterEach(() => {
      removeEventListeners()
    })

    it('syncs a new value from the storage event to the cache', () => {
      window.dispatchEvent(createStorageEvent('test', testValue))

      expect(cache.data.get('test')).toEqual(testValue)
      // It must not update the Local Storage. The Local Storage event is already
      // triggered by a Local Storage change, so a LS change should not change
      // (write to) the LS again and trigger another LS event.
      expect(toObject(storage, denormalize)).toEqual({})
      // It must broadcast the change to trigger rerenders
      expect(cache.broadcastWatches).toHaveBeenCalled()
      expect(client.queryManager.broadcastQueries).toHaveBeenCalled()
    })

    it('syncs a removed value from the storage event to the cache', () => {
      // This sets the value in both the storage and the memory
      cache.data.set('test', testValue)

      // Whenever we receive a storage event, the storage will also have been
      // updated. For testing purposes we must manually update it to reflect
      // what would have been the new state.
      storage.removeItem(`${defaultPrefix}test`)
      window.dispatchEvent(createStorageEvent('test', null))

      expect(cache.data.get('test')).toEqual(undefined)
      expect(toObject(storage, denormalize)).toEqual({})
      // It must broadcast the change to trigger rerenders
      expect(cache.broadcastWatches).toHaveBeenCalled()
      expect(client.queryManager.broadcastQueries).toHaveBeenCalled()
    })

    it('ignores unrelated storage events', () => {
      // This sets the value in both the storage and the memory
      cache.data.set('test', testValue)

      window.dispatchEvent(createStorageEvent('test', null, ''))

      expect(cache.data.get('test')).toEqual(testValue)
      expect(toObject(storage, denormalize)).not.toEqual({})
      expect(cache.broadcastWatches).not.toHaveBeenCalled()
      expect(client.queryManager.broadcastQueries).not.toHaveBeenCalled()
    })
  })

  describe('shouldPersist', () => {
    let cache!: InStorageCache
    let client!: ApolloClient<{}>
    let removeEventListeners!: () => void
    const shouldPersist = jest.fn(
      (operation: string, dataId: string) => dataId === 'valid',
    )
    beforeEach(() => {
      cache = createCache({
        shouldPersist,
      })
      client = new ApolloClient({ link, cache })
      cache.broadcastWatches = jest.fn()
      client.queryManager.broadcastQueries = jest.fn()
      removeEventListeners = keepCacheInSyncWithLocalStorage(cache, client)
    })
    afterEach(() => {
      removeEventListeners()
    })

    it('only stores when shouldPersist is true', () => {
      // shouldPersist=false
      window.dispatchEvent(createStorageEvent('test', testValue))

      expect(cache.data.get('test')).toEqual(undefined)
      expect(toObject(storage, denormalize)).toEqual({})
      expect(cache.broadcastWatches).not.toHaveBeenCalled()
      expect(client.queryManager.broadcastQueries).not.toHaveBeenCalled()

      // shouldPersist=true
      window.dispatchEvent(createStorageEvent('valid', testValue))

      expect(cache.data.get('valid')).toEqual(testValue)
      expect(toObject(storage, denormalize)).toEqual({})
      expect(cache.broadcastWatches).toHaveBeenCalled()
      expect(client.queryManager.broadcastQueries).toHaveBeenCalled()
    })
  })
})
