const config = require("../config")

// Simple logger with timestamp and levels
const logger = {
  info: (message, data) => {
    console.log(`[INFO] ${new Date().toISOString()}: ${message}`, data || "")
  },

  warn: (message, data) => {
    console.warn(`[WARN] ${new Date().toISOString()}: ${message}`, data || "")
  },

  error: (message, error) => {
    console.error(
      `[ERROR] ${new Date().toISOString()}: ${message}`,
      error || ""
    )
  },

  debug: (message, data) => {
    if (config.environment !== "production") {
      console.log(`[DEBUG] ${new Date().toISOString()}: ${message}`, data || "")
    }
  },

  // Logging for webhooks
  webhook: (service, eventType, status) => {
    console.log(
      `[WEBHOOK] ${new Date().toISOString()} - ${service}:${eventType} - ${status}`
    )
  },
}

module.exports = logger
