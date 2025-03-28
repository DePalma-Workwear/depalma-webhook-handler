const userCreatedHandler = require("./events/user-created")
const userUpdatedHandler = require("./events/user-updated")
const userDeletedHandler = require("./events/user-deleted")
const sessionCreatedHandler = require("./events/session-created")
const logger = require("../../utils/logger")
const { verifyWebhook } = require("./clerkUtils/verifyWebhook")
const webhookSecret = process.env.CLERK_WEBHOOK_SECRET

exports.handleWebhook = async (req, res) => {
  try {
    // Verify webhook signature first
    const payload = await verifyWebhook(req)

    // Identify event type from payload
    const eventType = payload.type
    logger.info(`Processing Clerk event: ${eventType}`)

    // Route to correct handler based on event type
    switch (eventType) {
      case "user.created":
        return userCreatedHandler(payload, res, webhookSecret)

      case "user.updated":
        return userUpdatedHandler(payload, res)

      case "user.deleted":
        return userDeletedHandler(payload, res)

      case "session.created":
        return sessionCreatedHandler(payload, res)

      default:
        // Handle unknown event type
        logger.warn(`Unhandled Clerk event type: ${eventType}`)
        return res.status(200).json({
          status: "ignored",
          message: `Event type ${eventType} not configured for processing`,
        })
    }
  } catch (error) {
    logger.error("Error in Clerk webhook handler:", error)
    return res
      .status(500)
      .json({ error: error.message || "Internal server error" })
  }
}
