import { InStorageCacheError, validStorage, toObject } from './utils'

class ObjectStorageCache {
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

    if (typeof persistence.prefix !== 'string') {
      throw new InStorageCacheError(
        'You must provide a persistence.prefix string'
      )
    }

    this.persistence = persistence
    this.data = { ...data }
  }

  toObject () {
    const persisted = toObject(
      this.persistence.storage,
      this.persistence.denormalize,
      this.persistence.prefix
    )

    return { ...persisted, ...this.data }
  }

  get (dataId) {
    let data = this.rawGet(dataId)
    if (!data && this.persistence.shouldPersist('get', dataId)) {
      data = this.data[dataId] = this.persistence.denormalize(
        this.persistence.storage.getItem(`${this.persistence.prefix}${dataId}`),
        dataId,
      )
    }

    return data
  }
  rawGet (dataId) {
    return this.data[dataId]
  }

  set (dataId, value) {
    if (this.persistence.shouldPersist('set', dataId, value)) {
      this.persistence.storage.setItem(
        `${this.persistence.prefix}${dataId}`,
        this.persistence.normalize(value, dataId)
      )
    }

    this.rawSet(dataId, value)
  }
  rawSet (dataId, value) {
    this.data[dataId] = value
  }

  delete (dataId) {
    if (this.persistence.shouldPersist('delete', dataId)) {
      this.persistence.storage.removeItem(`${this.persistence.prefix}${dataId}`)
    }

    this.rawDelete(dataId)
  }
  rawDelete (dataId) {
    delete this.data[dataId]
  }

  clear () {
    this.persistence.storage.clear()
    this.data = {}
  }

  replace (newData) {
    this.data = {}

    for (let dataId in newData) {
      this.set(dataId, {
        ...this.get(dataId),
        ...newData[dataId],
      })
    }
  }
}

export { ObjectStorageCache }
