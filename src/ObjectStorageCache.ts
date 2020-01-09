import {
  NormalizedCache,
  NormalizedCacheObject,
  StoreObject,
} from 'apollo-cache-inmemory'

import { toObject, iterate } from './utils'
import { Config } from './InStorageCache'

export default class ObjectStorageCache implements NormalizedCache {
  data: NormalizedCacheObject
  config: Config

  constructor(config: Config, data = {}) {
    this.config = config
    this.data = { ...data }
  }

  toObject() {
    const persisted = toObject(
      this.config.storage,
      this.config.denormalize,
      this.config.prefix,
    )

    return { ...persisted, ...this.data }
  }

  get(dataId: string): StoreObject {
    let data = this.rawGet(dataId)
    if (!data && this.config.shouldPersist('get', dataId)) {
      data = this.data[dataId] = this.config.denormalize(
        this.config.storage.getItem(`${this.config.prefix}${dataId}`),
        dataId,
      )
    }

    // I can't figure out how apollo-cache-inmemory makes this work. See:
    // https://github.com/apollographql/apollo-client/blob/80b09617a65437cee82e6f09c8866202bfa9cd2c/src/cache/inmemory/entityStore.ts#L43
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    return data!
  }
  rawGet(dataId: string) {
    return this.data[dataId]
  }

  set(dataId: string, value: StoreObject) {
    if (this.config.shouldPersist('set', dataId, value)) {
      this.config.storage.setItem(
        `${this.config.prefix}${dataId}`,
        this.config.normalize(value, dataId),
      )
    }

    this.rawSet(dataId, value)
  }
  rawSet(dataId: string, value: StoreObject) {
    this.data[dataId] = value
  }

  delete(dataId: string) {
    if (this.config.shouldPersist('delete', dataId)) {
      this.config.storage.removeItem(`${this.config.prefix}${dataId}`)
    }

    this.rawDelete(dataId)
  }
  rawDelete(dataId: string) {
    delete this.data[dataId]
  }

  clear() {
    iterate(this.config.storage, this.config.prefix, (dataId, value) => {
      this.config.storage.removeItem(`${this.config.prefix}${dataId}`)
    })
    this.data = {}
  }

  replace(newData: NormalizedCacheObject) {
    this.data = {}

    Object.keys(newData).forEach(dataId => {
      this.set(dataId, {
        ...this.get(dataId),
        ...newData[dataId],
      })
    })
  }
}
