import { ApolloLink } from 'apollo-link'

class PersistLink extends ApolloLink {
  static shouldPersist () {
    return false
  }

  /**
   * Link query requester.
   */
  request = (operation, forward) => {
    return forward(operation)
  }
}

const createPersistLink = config => new PersistLink(config)

export { PersistLink, createPersistLink }
