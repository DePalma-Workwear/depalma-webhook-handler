const express = require("express")
const serverless = require("serverless-http")
require("dotenv").config()

// Import handlers for different services
const clerkHandler = require("../../src/handlers/clerk/clerkhandler")
// Prepare for future services
// const stripeHandler = require('../../src/handlers/stripe');

// Import utility functions
const logger = require("../../src/utils/logger")
// const { handleError } = require("../../src/utils/error-handler")

// Create Express app
const app = express()

// Parse raw text bodies for webhook payload
app.use(express.text({ type: "application/json" }))

// Logging middleware
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path} - Request received`)
  next()
})

// Prepare for future services
const handlers = {
  clerk: clerkHandler,
  // stripe: stripeHandler,
}

// Main route for webhooks
app.post("*", async (req, res) => {
  console.log("webhook.js loaded")

  try {
    logger.info("Processing incoming webhook")

    // Identify webhook source based on headers
    const source = req.headers["x-webhook-source"] || "unknown"

    // Handle Clerk webhooks
    if (source === "clerk") {
      logger.info("Identified as Clerk webhook")
      await handlers.clerk.handleWebhook(req, res)
    }
    // Prepared for Stripe
    // else if (req.headers['stripe-signature']) {
    //   logger.info('Identified as Stripe webhook');
    //   await stripeHandler.handleWebhook(req, res);
    // }
    else {
      // Unknown source
      logger.warn("Unknown webhook source")
      res.status(400).json({ error: "Unknown webhook source" })
    }
  } catch (error) {
    logger.error("Error in webhook handler:", error)
    // handleError(res, error)
    res.status(500).json({ error: "Internal server error" })
  }
})

// Health check endpoint
app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok", timestamp: new Date().toISOString() })
})

// Export function with serverless wrapper
exports.handler = serverless(app)
