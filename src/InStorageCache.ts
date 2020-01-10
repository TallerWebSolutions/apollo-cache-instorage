import {
  InMemoryCache,
  InMemoryCacheConfig,
  StoreObject,
} from 'apollo-cache-inmemory'
import { DocumentNode } from 'graphql'

import ObjectStorageCache from './ObjectStorageCache'
import {
  InStorageCacheError,
  validStorage,
  normalize as defaultNormalize,
  denormalize as defaultDenormalize,
  Normalizer,
  Denormalizer,
} from './utils'
import { addPersistFieldToDocument } from './transform'

export type ShouldPersist = (
  operation: 'get' | 'set' | 'delete',
  dataId: string,
  data?: StoreObject,
) => boolean
export interface Config {
  /**
   * The Storage to use.
   *
   * @see https://www.w3.org/TR/webstorage/#storage
   */
  storage: Storage
  /** Normalization callback. Executed prior to storing a resource. */
  normalize: Normalizer
  /**
   * Denormalization callback. Executed after retrieving a cached resource from
   * the storage.
   */
  denormalize: Denormalizer
  /** Callback to determine if a given data should be cached. */
  shouldPersist: ShouldPersist
  /**
   * The prefix to use when saving to the provided storage. Useful to diff items
   * from this and other persisting systems that share the same storage.
   */
  prefix: string
}
export type PublicConfig = Partial<Config> &
  Required<Pick<Config, 'storage'>> &
  InMemoryCacheConfig & {
    addPersistField?: boolean | (() => boolean)
  }

// We need ts-ignore because we need to modify InMemoryCache's private property
// and TS provides no other way to make it public.
// eslint-disable-next-line @typescript-eslint/ban-ts-ignore
// @ts-ignore
export default class InStorageCache extends InMemoryCache {
  public data: ObjectStorageCache
  public persistence: Config

  protected addPersistField: (doc: DocumentNode) => boolean

  constructor({
    storage,
    normalize = defaultNormalize,
    denormalize = defaultDenormalize,
    shouldPersist = () => true,
    prefix = '',
    addPersistField = false,
    ...superConfig
  }: PublicConfig) {
    super(superConfig)
    if (!storage) {
      throw new InStorageCacheError('You must provide a storage to use')
    }
    if (!validStorage(storage)) {
      throw new InStorageCacheError('You must provide a valid storage to use')
    }
    if (typeof normalize !== 'function') {
      throw new InStorageCacheError(
        'You must provide a config.normalize function',
      )
    }
    if (typeof denormalize !== 'function') {
      throw new InStorageCacheError(
        'You must provide a config.denormalize function',
      )
    }
    if (typeof shouldPersist !== 'function') {
      throw new InStorageCacheError(
        'You must provide a config.shouldPersist function',
      )
    }
    if (typeof prefix !== 'string') {
      throw new InStorageCacheError('You must provide a config.prefix string')
    }

    this.persistence = {
      storage,
      normalize,
      denormalize,
      shouldPersist,
      prefix,
    }
    this.addPersistField =
      typeof addPersistField === 'function'
        ? addPersistField
        : () => addPersistField

    this.data = new ObjectStorageCache(this.persistence)
    // We need ts-ignore because we need to modify super's private property
    // and TS provides no other way to make it public.
    // eslint-disable-next-line @typescript-eslint/ban-ts-ignore
    // @ts-ignore
    this.optimisticData = this.data
  }

  transformDocument(doc: DocumentNode) {
    return super.transformDocument(
      this.addPersistField(doc) ? addPersistFieldToDocument(doc) : doc,
    )
  }

  // Make broadcastWatches public so it can be used to sync local storage across tabs
  public broadcastWatches() {
    super.broadcastWatches()
  }
}
