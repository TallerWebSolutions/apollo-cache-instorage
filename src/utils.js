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

export { InStorageCacheError, validStorage }
