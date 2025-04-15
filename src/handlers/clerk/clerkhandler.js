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
    logger.info("Received webhook request", {
      method: req.method,
      headers: req.headers,
      body: req.body,
    })

    // Verify webhook signature first
    const payload = await verifyWebhook(req)
    logger.info("Webhook verified", { payloadType: payload?.type })

    // Identify event type from payload
    const eventType = payload.type
    logger.info(`Processing Clerk event: ${eventType}`)

    // Manage user.updated event
    try {
      // Route to correct handler based on event type
      switch (eventType) {
        case "user.created":
          logger.info("Routing to user.created handler")
          await userCreatedHandler(payload, res, CLERK_WEBHOOK_SECRET_USER)
          break

        case "user.updated":
          logger.info("Routing to user.updated handler", {
            webhookSecret: CLERK_WEBHOOK_SECRET_USER_UPDATED
              ? "present"
              : "missing",
          })
          await userUpdatedHandler(
            payload,
            res,
            CLERK_WEBHOOK_SECRET_USER_UPDATED
          )
          break

        case "user.deleted":
          logger.info("Routing to user.deleted handler")
          await userDeletedHandler(payload, res)
          break

        case "session.created":
          logger.info("Routing to session.created handler")
          await sessionCreatedHandler(payload, res)
          break

        default:
          // Handle unknown event type
          logger.warn(`Unhandled Clerk event type: ${eventType}`)
      }

      // Send a status 200 back to Clerk
      res.status(200).json({
        status: "success",
        message: "Webhook processed successfully",
      })
    } catch (handlerError) {
      logger.error("Error in event handler:", {
        error: handlerError.message,
        stack: handlerError.stack,
        eventType,
      })
      // Skicka felmeddelande till Clerk
      res.status(500).json({
        error: handlerError.message || "Internal server error",
        status: "error",
      })
    }
  } catch (error) {
    logger.error("Error in Clerk webhook handler:", {
      error: error.message,
      stack: error.stack,
    })

    //make sure we always send a response even if there is an error
    res.status(500).json({
      error: error.message || "Internal server error",
      status: "error",
    })
  }
}
