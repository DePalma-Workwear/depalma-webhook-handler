const userCreatedHandler = require("./events/user-created")
const userUpdatedHandler = require("./events/user-updated")
const userDeletedHandler = require("./events/user-deleted")
const sessionCreatedHandler = require("./events/session-created")
const logger = require("../../utils/logger")
const { verifyWebhook } = require("./clerkUtils/verifyWebhook")
const CLERK_WEBHOOK_SECRET_USER = process.env.CLERK_WEBHOOK_SECRET_USER
const CLERK_WEBHOOK_SECRET_USER_UPDATED =
  process.env.CLERK_WEBHOOK_SECRET_USER_UPDATE
exports.handleWebhook = async (req, res) => {
  try {
    // Verify webhook signature first
    const payload = await verifyWebhook(req)

    // Identify event type from payload
    const eventType = payload.type
    logger.info(`Processing Clerk event: ${eventType}`)
    console.log("payload", payload, "eventType", eventType)

    // Route to correct handler based on event type
    switch (eventType) {
      case "user.created":
        return userCreatedHandler(payload, res, CLERK_WEBHOOK_SECRET_USER)

      case "user.updated":
        return userUpdatedHandler(
          payload,
          res,
          CLERK_WEBHOOK_SECRET_USER_UPDATED
        )

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
