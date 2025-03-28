const logger = require("./logger")

/**
 * Checks if the current request is running in test mode
 * @param {object} req - Express request object
 * @returns {boolean}
 */
const isTestMode = (req) => {
  return (
    req &&
    req.headers &&
    (req.headers["x-test-mode"] === "true" ||
      process.env.NODE_ENV === "development")
  )
}

module.exports = {
  isTestMode,
}
