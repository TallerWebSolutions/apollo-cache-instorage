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

  constructor ({
    storage,
    normalize = DepTrackingStorageCache.normalize,
    denormalize = DepTrackingStorageCache.denormalize,
    ...config
  } = {}) {
    super(config)

    if (!storage) {
      throw new InStorageCacheError('You must provide a storage to use')
    }

    this.persistence = {
      storage,
      normalize,
      denormalize
    }

    this.data = new DepTrackingStorageCache(null, this.persistence)
  }
}

class DepTrackingStorageCache {
  static toObject (storage, denormalize = defaults.denormalize) {
    const object = {}

    for (let i = 0; i < storage.length; ++i) {
      object[storage.key(i)] = denormalize(storage.getItem(storage.key(i)))
    }

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
    this.persistence.storage.setItem(dataId, this.persistence.normalize(value))
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
    // @TODO: implement
    this.data = newData || {}
  }
}

export { InStorageCache, DepTrackingStorageCache }
