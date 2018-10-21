import { InStorageCacheError, validStorage } from './utils'

const defaults = {
  normalize: JSON.stringify,
  denormalize: JSON.parse
}

class ObjectStorageCache {
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

    ObjectStorageCache.iterate(storage, key => {
      object[key] = denormalize(storage.getItem(key))
    })

    return object
  }

  static normalize = defaults.normalize

  static denormalize = defaults.denormalize

  constructor (data = {}, persistence = {}) {
    if (!persistence.storage) {
      throw new InStorageCacheError(
        'You must provide a persistence.storage to use'
      )
    }

    if (!validStorage(persistence.storage)) {
      throw new InStorageCacheError(
        'You must provide a valid persistence.storage to use'
      )
    }

    if (typeof persistence.normalize !== 'function') {
      throw new InStorageCacheError(
        'You must provide a persistence.normalize function'
      )
    }

    if (typeof persistence.denormalize !== 'function') {
      throw new InStorageCacheError(
        'You must provide a persistence.denormalize function'
      )
    }

    if (typeof persistence.shouldPersist !== 'function') {
      throw new InStorageCacheError(
        'You must provide a persistence.shouldPersist function'
      )
    }

    this.persistence = persistence
    this.data = { ...data }
  }

  toObject () {
    const persisted = ObjectStorageCache.toObject(
      this.persistence.storage,
      this.persistence.denormalize
    )

    return { ...persisted, ...this.data }
  }

  get (dataId) {
    if (!this.data[dataId] && this.persistence.shouldPersist('get', dataId)) {
      this.data[dataId] = this.persistence.denormalize(
        this.persistence.storage.getItem(dataId)
      )
    }

    return this.data[dataId]
  }

  set (dataId, value) {
    if (this.persistence.shouldPersist('set', dataId, value)) {
      this.persistence.storage.setItem(
        dataId,
        this.persistence.normalize(value)
      )
    }

    this.data[dataId] = value
  }

  delete (dataId) {
    if (this.persistence.shouldPersist('delete', dataId)) {
      this.persistence.storage.removeItem(dataId)
    }

    this.data[dataId] = undefined
  }

  clear () {
    this.persistence.storage.clear()
    this.data = {}
  }

  replace (newData) {
    this.data = {}

    for (let dataId in newData) {
      this.set(dataId, newData[dataId])
    }
  }
}

export { ObjectStorageCache }
