import { InMemoryCache } from 'apollo-cache-inmemory'

const defaults = {
  normalize: JSON.stringify,
  denormalize: JSON.parse
}

class InStorageCacheError extends Error {
  constructor (message, ...args) {
    super(`[InStorageCacheError] ${message}`, ...args)
  }
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

  constructor ({
    storage,
    normalize = DepTrackingStorageCache.normalize,
    denormalize = DepTrackingStorageCache.denormalize,
    shouldPersist = () => true,
    ...config
  } = {}) {
    super(config)

    if (!storage) {
      throw new InStorageCacheError('You must provide a storage to use')
    }

    this.persistence = {
      storage,
      normalize,
      denormalize,
      shouldPersist
    }

    this.data = new DepTrackingStorageCache(null, this.persistence)
  }
}

class DepTrackingStorageCache {
  /**
   * Iterates each key of the storage and execute the callback on it.
   *
   * @param {Object} storage The storage instance.
   * @param {Function} callback The iteration callback.
   */
  static iterate (storage, callback) {
    for (let i = 0; i < storage.length; ++i) {
      callback(storage.key(i))
    }
  }

  /**
   * Creates a plain object from all the storage's persisted data.
   *
   * @param {Object} storage The storage instance.
   * @param {Function} denormalize Method of denormalizing the retrieved resource.
   */
  static toObject (storage, denormalize = defaults.denormalize) {
    const object = {}

    DepTrackingStorageCache.iterate(storage, key => {
      object[key] = denormalize(storage.getItem(key))
    })

    return object
  }

  static normalize = defaults.normalize

  static denormalize = defaults.denormalize

  constructor (data = {}, persistence) {
    this.persistence = persistence
    this.data = { ...data }
  }

  toObject () {
    return DepTrackingStorageCache.toObject(
      this.persistence.storage,
      this.persistence.denormalize
    )
  }

  get (dataId) {
    if (!this.data[dataId]) {
      this.data[dataId] = this.persistence.denormalize(
        this.persistence.storage.getItem(dataId)
      )
    }
    return this.data[dataId]
  }

  set (dataId, value) {
    if (this.persistence.shouldPersist(dataId, value)) {
      this.persistence.storage.setItem(
        dataId,
        this.persistence.normalize(value)
      )
    }

    this.data[dataId] = value
  }

  delete (dataId) {
    this.persistence.storage.removeItem(dataId)
    this.data[dataId] = undefined
  }

  clear () {
    this.persistence.storage.clear()
    this.data = Object.create(null)
  }

  replace (newData) {
    // Refresh data.
    this.data = {}

    for (let dataId in newData) {
      this.set(dataId, newData[dataId])
    }
  }
}

export { InStorageCache, DepTrackingStorageCache }
