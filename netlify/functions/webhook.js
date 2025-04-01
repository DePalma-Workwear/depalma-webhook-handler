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

    // Identify Clerk webhooks based on Svix headers
    if (
      req.headers["svix-id"] &&
      req.headers["svix-timestamp"] &&
      req.headers["svix-signature"]
    ) {
      logger.info("Identified as Clerk webhook based on Svix headers")
      await handlers.clerk.handleWebhook(req, res)
    }
    //Test-method with x-webhook-source
    else if (req.headers["x-webhook-source"] === "clerk") {
      logger.info("Identified as Clerk webhook based on x-webhook-source")
      await handlers.clerk.handleWebhook(req, res)
    }
    // Handle test-mode
    else if (req.headers["x-test-mode"] === "true") {
      logger.info("Test mode webhook received")
      res.status(200).json({ message: "Test webhook received successfully" })
    }
    // Prepared for Stripe (commented in original)
    // else if (req.headers['stripe-signature']) {
    //   logger.info('Identified as Stripe webhook');
    //   await stripeHandler.handleWebhook(req, res);
    // }
    else {
      // Unknown source
      logger.warn("Unknown webhook source")
      logger.warn("Headers received:", JSON.stringify(req.headers))
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
