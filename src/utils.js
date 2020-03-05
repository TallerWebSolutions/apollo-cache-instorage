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
 * @param {String} prefix The storage persisting key prefix.
 */
const toObject = (storage, denormalize = value => value, prefix = '') => {
  const object = {}

  iterate(storage, key => {
    if (key.indexOf(prefix) === 0) {
      object[key.slice(prefix.length)] = denormalize(storage.getItem(key))
    }
  })

  return object
}

const normalize = (value, dataId) => JSON.stringify(value)
const denormalize = (value, dataId) => {
  if (value === null) {
    return undefined
  }
  else {
    if (value instanceof Promise) {
      value
        .then(data => {
          return JSON.parse(data)
        })
        .catch(() => null)
    }
    else {
      return JSON.parse(value)
    }
  }
}

export { InStorageCacheError, validStorage, toObject, normalize, denormalize }
