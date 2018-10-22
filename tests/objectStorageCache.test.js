import storage from 'localStorage'
import { ObjectStorageCache } from '../src/objectStorageCache'
import { normalize, denormalize } from '../src/utils'

describe('ObjectStorageCache', () => {
  const config = {
    storage,
    normalize,
    denormalize,
    shouldPersist: () => true
  }

  describe('constructor', () => {
    it('should throw when no persistence config provided', () => {
      expect(() => new ObjectStorageCache()).toThrow(
        'must provide a persistence.storage'
      )
    })

    it('should throw when invalid storage provided', () => {
      expect(() => new ObjectStorageCache(null, { storage: {} })).toThrow(
        'must provide a valid persistence.storage'
      )
    })

    it('should throw when no normalizer provided', () => {
      expect(() => new ObjectStorageCache(null, { storage })).toThrow(
        'must provide a persistence.normalize'
      )
    })

    it('should throw when no denormalizer provided', () => {
      expect(
        () => new ObjectStorageCache(null, { storage, normalize })
      ).toThrow('must provide a persistence.denormalize')
    })

    it('should throw when no shouldPersist provided', () => {
      expect(
        () => new ObjectStorageCache(null, { storage, normalize, denormalize })
      ).toThrow('must provide a persistence.shouldPersist')
    })

    it('should construct when provided with all necessary config', () => {
      expect(() => new ObjectStorageCache(null, config)).not.toThrow()
    })
  })

  describe('toObject', () => {
    it('should return a plain object with all stored data', () => {
      const initial = { key: 'value' }
      const data = new ObjectStorageCache(initial, config)

      expect(data.toObject()).toEqual({ key: 'value' })
    })
  })

  it('should delete from storage', () => {
    const data = new ObjectStorageCache(null, config)
    data.set('key', 'value')
    expect(denormalize(storage.getItem('key'))).toBe('value')
    data.delete('key')
    expect(storage.getItem('key')).toBe(null)
  })

  it('should NOT delete from storage when told so', () => {
    const shouldPersist = op => op !== 'delete'
    const data = new ObjectStorageCache(null, { ...config, shouldPersist })
    data.set('key', 'value')
    expect(denormalize(storage.getItem('key'))).toBe('value')
    data.delete('key')
    expect(denormalize(storage.getItem('key'))).toBe('value')
  })
})
