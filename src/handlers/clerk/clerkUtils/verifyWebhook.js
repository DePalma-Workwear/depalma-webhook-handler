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

    // Get webhook secret
    const webhookSecret = process.env.CLERK_WEBHOOK_SECRET
    if (!webhookSecret) {
      throw new Error("Missing CLERK_WEBHOOK_SECRET environment variable")
    }

    // Verify webhook signature with Svix
    const wh = new Webhook(webhookSecret)
    const payload = req.body // Raw payload

    const verifiedPayload = wh.verify(payload, {
      "svix-id": svixId,
      "svix-timestamp": svixTimestamp,
      "svix-signature": svixSignature,
    })

    logger.info("Webhook verified successfully")
    return verifiedPayload
  } catch (error) {
    logger.error("Webhook verification failed:", error)
    throw error // Let the caller handle the error
  }
}
