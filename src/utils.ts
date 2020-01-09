import { NormalizedCacheObject, StoreObject } from 'apollo-cache-inmemory'

export class InStorageCacheError extends Error {
  constructor(message: string) {
    super(`[InStorageCacheError] ${message}`)
  }
}

export const validStorage = (storage: Storage) =>
  Boolean(
    storage &&
      storage.getItem &&
      storage.setItem &&
      storage.removeItem &&
      storage.clear,
  )

/**
 * Iterates each key of the storage and execute the callback on it.
 */
export const iterate = (
  storage: Storage,
  prefix = '',
  callback: (key: string, value: string) => void,
) => {
  for (let i = 0; i < storage.length; ++i) {
    const key = storage.key(i)
    if (key === null || !key.startsWith(prefix)) {
      continue
    }
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const value = storage.getItem(key)!
    callback(key.slice(prefix.length), value)
  }
}

/**
 * Creates a plain object from all the storage's persisted data.
 */
export const toObject = (
  storage: Storage,
  denormalize: Denormalizer,
  prefix = '',
) => {
  const object: NormalizedCacheObject = {}

  iterate(storage, prefix, (dataId, value) => {
    object[dataId] = denormalize(value, dataId)
  })

  return object
}

export type Normalizer = (value: StoreObject, dataId: string) => string
export type Denormalizer = (value: string | null, dataId: string) => StoreObject

export const normalize: Normalizer = (value, dataId) => JSON.stringify(value)
export const denormalize: Denormalizer = (value, dataId) => value !== null ? JSON.parse(value) : null
