import { StoreObject } from 'apollo-cache-inmemory'
import { ApolloClient } from 'apollo-client'

import InStorageCache from './InStorageCache'

/**
 * This method enhances an InStorageCache enabled ApolloClient with local
 * storage synchronization across tabs.
 *
 * NOTE: A `prefix` is required in InStorageCache to be able to detect if the
 * LS values were from the Apollo store so unrelated LS values can be ignored.
 *
 * @param {InStorageCache} cache
 * @param {ApolloClient<any>} client This is only needed to trigger a rerender.
 * The actual data is synced in the cache.
 * @param {(cache, dataId: string, newValue: string | null) => void} writer
 */
export default function keepCacheInSyncWithLocalStorage(
  cache: InStorageCache,
  client: ApolloClient<{}>,
) {
  const { prefix, shouldPersist, storage, denormalize } = cache.persistence
  if (!prefix) {
    throw new Error(
      'The cache has no prefix configured. A prefix is required to be able ' +
        'to ignore LocalStorage values that are not related to the Apollo ' +
        'cache.',
    )
  }
  if (client.cache !== cache) {
    // We don't grab the cache from the client because that type is too generic
    // and we can only work with InStorageCache. It also makes more sense to
    // have this method be applied to the cache than the client. The client
    // is only necessary to trigger a re-render and therefore has less
    // importance.
    throw new Error(
      'The provided client must be using the provided cache instance. As a ' +
        'shortcut you can pass `client.cache` as the first parameter, but ' +
        'you might have to (unsafely) cast it to InStorageCache.',
    )
  }
  if (storage !== window.localStorage) {
    // This approach could work with other storage providers with custom events
    // but that will require some refactoring
    throw new Error(
      'Cache synchronisation is only available when using localStorage as ' +
        'storage provider.',
    )
  }

  const broadcastChanges = () => {
    // Invalidate data so Apollo knows things changed. This doesn't trigger a
    // re-render (which seems strange but it looks to be intended)
    cache.broadcastWatches()
    // Trigger queries with changed data to rerender
    client.queryManager.broadcastQueries()
  }
  const setNewValue = (dataId: string, newValue: StoreObject | undefined) => {
    // Using `raw*` methods to bypass the saving to LS since the values are
    // obviously already in LS
    if (newValue === undefined) {
      cache.data.rawDelete(dataId)
    } else {
      cache.data.rawSet(dataId, newValue)
    }
    broadcastChanges()
  }
  const handleStorageChange = ({ key, newValue }: StorageEvent) => {
    if (!key || !key.startsWith(prefix)) {
      // Ignore any LS keys that are unrelated to the Apollo cache
      return
    }

    const dataId = key.substr(prefix.length)
    if (shouldPersist('set', dataId)) {
      // This is theoretically always true, as values that should not be
      // persisted should have never been in LS

      setNewValue(dataId, denormalize(newValue, dataId))
    }
  }

  window.addEventListener('storage', handleStorageChange)
  return () => {
    window.removeEventListener('storage', handleStorageChange)
  }
}
