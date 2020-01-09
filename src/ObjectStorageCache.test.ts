import ObjectStorageCache from './ObjectStorageCache'
import { normalize, denormalize } from './utils'

const storage = localStorage

describe('ObjectStorageCache', () => {
  beforeEach(() => {
    storage.clear()
  })

  const config = {
    storage,
    normalize,
    denormalize,
    shouldPersist: () => true,
    prefix: '',
  }

  describe('constructor', () => {
    it('should construct when provided with all necessary config', () => {
      expect(() => new ObjectStorageCache(config)).not.toThrow()
    })
  })

  describe('toObject', () => {
    it('should return a plain object with all stored data', () => {
      const initial = { name: 'value' }
      const data = new ObjectStorageCache(config, initial)
      expect(data.toObject()).toEqual({ name: 'value' })
    })

    it('should return a plain object with all persisted stored data', () => {
      const prefix = 'prefix-'
      storage.setItem(`${prefix}name`, '"value"')
      const data = new ObjectStorageCache({ ...config, prefix })
      expect(data.toObject()).toEqual({ name: 'value' })
    })

    it('should return only persisted data with same prefix', () => {
      storage.setItem('name', '"value"')
      const data = new ObjectStorageCache(config)
      expect(data.toObject()).toEqual({ name: 'value' })
    })
  })

  it('should delete from storage', () => {
    const data = new ObjectStorageCache(config)
    data.set('name', {
      value: 'value',
    })
    expect(data.get('name')).toEqual({
      value: 'value',
    })
    data.delete('name')
    expect(data.get('name')).toBe(null)
  })

  it('should NOT delete from storage when told so', () => {
    const shouldPersist = (op: string) => op !== 'delete'
    const data = new ObjectStorageCache({
      ...config,
      shouldPersist,
    })
    data.set('name', {
      value: 'value',
    })
    expect(data.get('name')).toEqual({
      value: 'value',
    })
    data.delete('name')
    expect(data.get('name')).toEqual({
      value: 'value',
    })
  })
})
