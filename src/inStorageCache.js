import { InMemoryCache } from 'apollo-cache-inmemory'

import { ObjectStorageCache } from './objectStorageCache'
import { InStorageCacheError, validStorage } from './utils'

class InStorageCache extends InMemoryCache {
  /**
   * @property {(Object|Function)} storage - The Storage to use.
   *
   * @see https://www.w3.org/TR/webstorage/#storage
   */
  storage

  /**
   * @property {Function} [normalize] - Normalization callback. Executed
   * prior to storing a resource.
   */
  normalize

  /**
   * @property {Function} [denormalize] - Denormalization callback. Executed
   * after retrieving a cached resource from the storage.
   */
  denormalize

  /**
   * @property {Function} [shouldPersist] - Callback to determine if a given
   * data should be cached.
   */
  shouldPersist

  constructor ({
    storage,
    normalize = ObjectStorageCache.normalize,
    denormalize = ObjectStorageCache.denormalize,
    shouldPersist = () => true,
    ...config
  } = {}) {
    super(config)

    if (!storage) {
      throw new InStorageCacheError('You must provide a storage to use')
    }

    if (!validStorage(storage)) {
      throw new InStorageCacheError('You must provide a valid storage to use')
    }

    this.persistence = {
      storage,
      normalize,
      denormalize,
      shouldPersist
    }

    this.data = new ObjectStorageCache(null, this.persistence)
  }
}

export { InStorageCache }
