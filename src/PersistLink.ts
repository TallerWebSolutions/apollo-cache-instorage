import { DocumentNode, visit } from 'graphql'
import { ApolloLink, NextLink, Operation } from 'apollo-link'
import traverse from 'traverse'
import { StoreObject } from 'apollo-cache-inmemory'

import { extractPersistDirectivePaths, hasPersistDirective } from './transform'

/**
 * Given a data result object path, return the equivalent query selection path.
 *
 * @param {Array} path The data result object path. i.e.: ["a", 0, "b"]
 * @return {String} the query selection path. i.e.: "a.b"
 */
const toQueryPath = (path: Array<string | number>) =>
  path.filter(key => isNaN(Number(key))).join('.')

// TODO: Make private by not exporting
/**
 * Given a data result object, attach __persist values.
 */
export const attachPersists = (paths: string[][], object: object) => {
  const queryPaths = paths.map(toQueryPath)

  return traverse(object).forEach(function() {
    if (
      !this.isRoot &&
      this.node &&
      typeof this.node === 'object' &&
      Object.keys(this.node).length &&
      !Array.isArray(this.node)
    ) {
      const path = toQueryPath(this.path)

      this.update({
        __persist: Boolean(
          queryPaths.find(
            queryPath =>
              queryPath.indexOf(path) === 0 || path.indexOf(queryPath) === 0,
          ),
        ),
        ...this.node,
      })
    }
  })
}

export default class PersistLink extends ApolloLink {
  /**
   * InStorageCache shouldPersist implementation for a __persist field validation.
   */
  static shouldPersist(
    op: 'set' | 'get' | 'delete',
    dataId: string,
    data?: StoreObject,
  ) {
    // console.log(dataId, data)
    return dataId === 'ROOT_QUERY' || !data || !!data.__persist
  }

  /**
   * InStorageCache addPersistField implementation to check for @perist directives.
   */
  static addPersistField = (doc: DocumentNode) => hasPersistDirective(doc)

  directive = 'persist'

  /**
   * Link query requester.
   */
  request(operation: Operation, forward?: NextLink) {
    const { query, paths } = extractPersistDirectivePaths(
      operation.query,
      this.directive,
    )

    // Early exit if no persist directive found.
    if (!paths.length) {
      return forward ? forward(operation) : null
    }

    // Replace query with one without @persist directives.
    operation.query = query

    // Remove requesting __persist fields.
    operation.query = visit(operation.query, {
      Field: ({ name: { value: name } }, key, parent, path, ancestors) => {
        if (name === '__persist') {
          return null
        }
        return
      },
    })

    return forward
      ? forward(operation).map(result => {
          if (result.data) {
            result.data = attachPersists(paths, result.data)
          }

          return result
        })
      : null
  }
}
