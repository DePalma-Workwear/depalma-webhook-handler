const logger = require("../../utils/logger")
const axios = require("axios")
const config = require("../../config")

async function sendToZapier(payload, oldData = null) {
  try {
    const webhookUrl = process.env.ZAPIER_WEBHOOK_URL
    if (!webhookUrl) {
      throw new Error("ZAPIER_WEBHOOK_URL is not configured")
    }

    const payloadType = payload.type
    const userId = payload.data.id

    logger.info("Sending data to Zapier webhook", {
      webhookUrl,
      payloadType,
      userId,
    })

    let dataToSend = {
      type: payloadType,
      userId: userId,
      oldData: null,
      newData: null,
    }

    if (payloadType === "user.updated" && oldData) {
      dataToSend.oldData = oldData
      dataToSend.newData = payload.data
    }

    logger.info("Data to send", { dataToSend })

    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(dataToSend),
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    logger.info("Successfully sent data to Zapier", {
      status: response.status,
      webhookUrl,
      payloadType,
    })

    return response
  } catch (error) {
    logger.error("Error sending data to Zapier:", error)
    throw error
  }
}

async function sendUserUpdatedToZapier(payload, data, oldData) {
  try {
    logger.info("Sending user.updated data to Zapier", {
      userId: data.id,
      hasOldData: !!oldData,
    })

    await sendToZapier(payload, oldData)
  } catch (error) {
    logger.error("Error in sendUserUpdatedToZapier:", error)
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

module.exports = {
  sendUserCreatedToZapier,
  sendUserUpdatedToZapier,
}
