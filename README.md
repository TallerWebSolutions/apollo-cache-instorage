# Apollo InStorageCache

[![Build Status](https://travis-ci.org/TallerWebSolutions/apollo-cache-instorage.svg?branch=master)](https://travis-ci.org/TallerWebSolutions/apollo-cache-instorage)
[![coverage](https://img.shields.io/codecov/c/github/TallerWebSolutions/apollo-cache-instorage.svg?style=flat-square)](https://codecov.io/github/TallerWebSolutions/apollo-cache-instorage)
[![npm version](https://img.shields.io/npm/v/apollo-cache-instorage.svg?style=flat-square)](https://www.npmjs.com/package/apollo-cache-instorage)
[![sponsored by Taller](https://raw.githubusercontent.com/TallerWebSolutions/tallerwebsolutions.github.io/master/sponsored-by-taller.png)](https://taller.net.br/en/)

`apollo-cache-instorage` is an extension to `apollo-cache-inmemory` that allows
for granular cacheability of resources, in a storage of choice.

## Purpose

The most famous implementation of a persistence layer for Apollo Client is
`apollo-cache-persist`. The main caveats with that project is the fastly
growing size of the cache, and the incapability of chosing what needs and
needs not to be cached. `apollo-cache-instorage` solves that, while reducing
the complexity on the setup and limiting interaction points between the
caching solution and the Apollo Client multiple services.

## Installation

`yarn add apollo-cache-instorage`

## Usage

`InStorageCache` is an extension of `InMemoryCache`, so initialization is not so
different than the other:

```js
import { InStorageCache } from 'apollo-cache-instorage'
import { HttpLink } from 'apollo-link-http'
import ApolloClient from 'apollo-client'

const cache = new InStorageCache({
  storage: window.localStorage,
})

const client = new ApolloClient({
  link: new HttpLink(),
  cache,
})
```

### Configuration

The `InStorageCache` constructor takes a config object with all the [options available for `InMemoryCache`](https://www.apollographql.com/docs/react/advanced/caching.html#configuration) plus the following customization properties:

| name          | type     | default          | required |
| ------------- | -------- | ---------------- | -------- |
| storage       | Object   |                  | true     |
| shouldPersist | Function | `() => true`     | false    |
| normalize     | Function | `JSON.stringify` | false    |
| denormalize   | Function | `JSON.parse`     | false    |
| prefix        | String   | `''`             | false    |

#### `storage`

A [Web Storage](https://www.w3.org/TR/webstorage/#storage) complient storage implementation.

#### `shouldPersist`

```
shouldPersist(
  operation: String,
  dataId: String,
  value: ?Object
)
```

Callback to determine if a given data object should be cached. Takes three arguments:

- `operation`: the ongoing storage operation. Will either be `get`, `set`, or `delete`;
- `dataId`: a data object ID as resolved by [`dataIdFromObject`](https://www.apollographql.com/docs/react/advanced/caching.html#configuration);
- `value`: the persisting data object, in case the operation is `set`.

#### `normalize`

```
normalize(
  value: Object,
  dataId: string
)
```

Normalization executed against a data object before attaching to the storage for persistence. Defaults to `JSON.stringify`.

#### `denormalize`

Denormalization executed against a persisted data after retrieving from the storage. Defaults to `JSON.parse`.

#### `prefix`

A prefix to use when persisting data to the storage. Useful for cases when the storage is shared between other application needs.

### `@persist` directive

To facilititate persistance opt-in, this package also provides a mechanism to identify parts of a query that should be persisted using a `@persist` directive. To enable that, you must:

1. Configure `InStorageCache` with an extra key `addPersistField` set to `true`;
2. Use a provided special implementation of `shouldPersist`;
3. Add the `PersistLink` to the chain of links.

```js
import { ApolloLink } from 'apollo-link'
import { createHttpLink } from 'apollo-link-http'
import { InStorageCache, PersistLink } from 'apollo-cache-instorage'

const cache = new InStorageCache({
  addPersistField: true,
  shouldPersist: PersistLink.shouldPersist,
})

const link = ApolloLink.from([
  new PersistLink(),
  createHttpLink({ uri: '/graphql' }),
])
```

Then, you can mark query selections for persisting using the directive:

```graphql
query SomeQuery {
  nonPersistingSelection {
    field
  }

  persistingSelection @persist {
    field
  }

  deepPersistingSelection {
    persistingSelection @persist {
      field
    }
  }
}
```

## Caveats

### `ROOT_QUERY`

Most of the cache consumption in Apollo starts off on the `ROOT_QUERY` special key. Make sure that if you implement `shouldPersist` you always allow the storage to persist the data related to this key, such as follows:

```js
const shouldPersist = (operation, dataId, value) => {
  if (dataId === 'ROOT_QUERY') return true
  // ... other logic here.
}
```

### `cache.restore()`

When restoring the cache (SSR hydration, for instance), keep in mind that any value inserted via hydrating will have precedence over the persisted data.
