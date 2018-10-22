import { InMemoryCache } from 'apollo-cache-inmemory'

import { ObjectStorageCache } from './objectStorageCache'
import { addPersistFieldToDocument } from './transform'

import {
  InStorageCacheError,
  validStorage,
  normalize,
  denormalize
} from './utils'

const defaults = {
  normalize,
  denormalize
}

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

  /**
   * @property {boolean} [addPersistField] - Whether or not should add a
   * __persist field to all non scalar types in a query.
   */
  addPersistField

  constructor ({
    storage,
    normalize = defaults.normalize,
    denormalize = defaults.denormalize,
    shouldPersist = () => true,
    addPersistField = false,
    ...config
  } = {}) {
    super(config)

    if (!storage) {
      throw new InStorageCacheError('You must provide a storage to use')
    }

    if (!validStorage(storage)) {
      throw new InStorageCacheError('You must provide a valid storage to use')
    }

    this.addPersistField = addPersistField

    this.persistence = {
      storage,
      normalize,
      denormalize,
      shouldPersist
    }

    this.data = new ObjectStorageCache(null, this.persistence)
  }

  transformDocument (doc) {
    return super.transformDocument(
      this.addPersistField ? addPersistFieldToDocument(doc) : doc
    )
  }
}

export { InStorageCache }
