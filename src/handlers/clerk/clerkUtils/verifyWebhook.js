// in src/handlers/clerk/utils.js or similar
const { Webhook } = require("svix")
const logger = require("../../../utils/logger")

exports.verifyWebhook = (req) => {
  // Check if we're in test mode
  if (
    req.headers["x-test-mode"] === "true" ||
    process.env.NODE_ENV === "development"
  ) {
    logger.info("Running in test mode, skipping verification")
    return JSON.parse(req.body)
  }

  // Perform normal verification here
  try {
    // Get Svix headers
    const svixId = req.headers["svix-id"]
    const svixTimestamp = req.headers["svix-timestamp"]
    const svixSignature = req.headers["svix-signature"]

    // Validate Svix headers
    if (!svixId || !svixTimestamp || !svixSignature) {
      throw new Error("Missing required Svix headers")
    }

    // Parse the raw body to get event type
    const rawPayload = JSON.parse(req.body)
    const eventType = rawPayload.type

    // Get the appropriate webhook secret based on event type
    let webhookSecret
    switch (eventType) {
      case "user.created":
        webhookSecret = process.env.CLERK_WEBHOOK_SECRET_USER
        break
      case "user.updated":
        webhookSecret = process.env.CLERK_WEBHOOK_SECRET_USER_UPDATED
        break
      case "user.deleted":
        webhookSecret = process.env.CLERK_WEBHOOK_SECRET_USER_DELETED
        break
      case "session.created":
        webhookSecret = process.env.CLERK_WEBHOOK_SECRET_SESSION
        break
      default:
        webhookSecret = process.env.CLERK_WEBHOOK_SECRET // fallback
    }

    if (!webhookSecret) {
      throw new Error(`Missing webhook secret for event type: ${eventType}`)
    }

    // Verify webhook signature with Svix
    const wh = new Webhook(webhookSecret)
    const payload = req.body // Raw payload

    const verifiedPayload = wh.verify(payload, {
      "svix-id": svixId,
      "svix-timestamp": svixTimestamp,
      "svix-signature": svixSignature,
    })

    logger.info(`Webhook verified successfully for event type: ${eventType}`)
    return verifiedPayload
  } catch (error) {
    logger.error("Webhook verification failed:", error)
    throw error // Let the caller handle the error
  }
}
