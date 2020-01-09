import { ApolloClient } from 'apollo-client'

import InStorageCache from './InStorageCache'

function writeNewValue(
  { data: objectStorage, persistence: { denormalize } }: InStorageCache,
  dataId: string,
  newValue: string | null,
) {
  // Using `raw*` methods to bypass the saving to LS since the values are obviously already in LS
  if (newValue === null) {
    objectStorage.rawDelete(dataId)
  } else {
    objectStorage.rawSet(dataId, denormalize(newValue, dataId))
  }
}

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
  writer = writeNewValue,
) {
  const { prefix, shouldPersist, storage } = cache.persistence
  if (process.env.NODE_ENV !== 'production') {
    if (!prefix) {
      throw new Error(
        'The cache has no prefix configured. A prefix is required to be able to ignore LocalStorage values that are not related to the Apollo cache.',
      )
    }
    if (client.cache !== cache) {
      // We don't grab the cache from the client because that type is too generic and we can only work with InStorageCache. It also makes more sense to have this method be applied to the cache than the client and the client is secondary only necessary to trigger a re-render.
      throw new Error(
        'The provided cache must match the cache used in the ApolloClient. As a shortcut you can pass `client.cache` as the first parameter, but you might have to (unsafely) cast it to InStorageCache.',
      )
    }
    if (storage !== window.localStorage) {
      // This approach could work with other storage providers with custom events but that will require some refactoring
      throw new Error(
        'Cache synchronisation is only available when using localStorage as storage provider.',
      )
    }
  }
  const prefixLength = prefix.length

  window.addEventListener('storage', ({ key, newValue }) => {
    if (!key || !key.startsWith(prefix)) {
      // Ignore any LS keys that are unrelated to the Apollo cache
      return
    }

    const dataId = key.substr(prefixLength)
    if (shouldPersist('set', dataId)) {
      // This is theoretically always true, as values that should not be persisted should have never been in LS

      writer(cache, dataId, newValue)

      // Invalidate data so Apollo knows things changed. This doesn't trigger a re-render (which seems strange but it looks to be intended)
      cache.broadcastWatches()
      // Trigger queries with changed data to rerender
      client.queryManager.broadcastQueries()
    }
  })
}
