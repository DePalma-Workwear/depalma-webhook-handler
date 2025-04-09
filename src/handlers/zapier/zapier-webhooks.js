const logger = require("../../utils/logger")
const axios = require("axios")
const config = require("../../config")

const sendToZapier = async (webhookUrl, payload) => {
  try {
    logger.info("Sending data to Zapier webhook", {
      webhookUrl,
      payloadType: payload.type,
      userId: payload.data?.id,
    })

    const response = await axios.post(webhookUrl, payload)

    logger.info("Successfully sent data to Zapier", {
      status: response.status,
      webhookUrl,
      payloadType: payload.type,
    })

    return response.data
  } catch (error) {
    logger.error("Error sending data to Zapier", {
      error: error.message,
      webhookUrl,
      payloadType: payload.type,
    })
    throw error
  }
}

const sendUserCreatedToZapier = async (payload) => {
  // if (!config.zapier.userCreatedWebhookUrl) {
  //   logger.warn("No Zapier webhook URL configured for user.created events")
  //   return
  // }

  // return sendToZapier(config.zapier.userCreatedWebhookUrl, payload)
  return sendToZapier(
    "https://webhook.site/2c1cc6f6-21c5-43a7-946d-f3bffe86f8e5",
    payload
  )
}

const sendUserUpdatedToZapier = async (payload) => {
  // if (!config.zapier.userUpdatedWebhookUrl) {
  //   logger.warn("No Zapier webhook URL configured for user.updated events")
  //   return
  // }

  // return sendToZapier(config.zapier.userUpdatedWebhookUrl, payload)
  return sendToZapier(
    "https://webhook.site/2c1cc6f6-21c5-43a7-946d-f3bffe86f8e5",
    payload
  )
}

module.exports = {
  sendUserCreatedToZapier,
  sendUserUpdatedToZapier,
}
