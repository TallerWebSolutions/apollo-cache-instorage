class InStorageCacheError extends Error {
  constructor (message, ...args) {
    super(`[InStorageCacheError] ${message}`, ...args)
  }
}

const validStorage = storage =>
  Boolean(
    storage &&
      storage.getItem &&
      storage.setItem &&
      storage.removeItem &&
      storage.clear
  )

/**
 * Iterates each key of the storage and execute the callback on it.
 *
 * @param {Object} storage The storage instance.
 * @param {Function} callback The iteration callback.
 */
const iterate = (storage, callback) => {
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
const toObject = (storage, denormalize = value => value) => {
  const object = {}

  iterate(storage, key => {
    object[key] = denormalize(storage.getItem(key))
  })

  return object
}

const normalize = JSON.stringify
const denormalize = JSON.parse

export { InStorageCacheError, validStorage, toObject, normalize, denormalize }
