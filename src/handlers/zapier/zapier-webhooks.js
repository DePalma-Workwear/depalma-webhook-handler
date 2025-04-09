const logger = require("../../utils/logger")
const axios = require("axios")
const config = require("../../config")

const getChangedFields = (oldData, newData) => {
  const changes = {}
  const changedFields = []

  // Mapping between Clerk's field names and Supabase's field names
  const fieldMappings = {
    first_name: "firstName",
    last_name: "lastName",
    username: "username",
    email_addresses: "emailAddresses",
    external_accounts: "externalAccounts",
  }

  Object.entries(fieldMappings).forEach(([clerkField, supabaseField]) => {
    const oldValue = oldData[supabaseField]
    const newValue = newData.data[clerkField]

    // Skip if both values are undefined or null
    if (oldValue === undefined && newValue === undefined) return
    if (oldValue === null && newValue === null) return

    // For arrays, compare content
    if (
      clerkField === "email_addresses" ||
      clerkField === "external_accounts"
    ) {
      const oldArray = Array.isArray(oldValue) ? oldValue : []
      const newArray = Array.isArray(newValue) ? newValue : []

      if (JSON.stringify(oldArray) !== JSON.stringify(newArray)) {
        changes[`new_${clerkField}`] = newArray
        changes[`old_${clerkField}`] = oldArray
        changedFields.push(clerkField)
      }
    } else {
      // For simple fields, compare values
      if (oldValue !== newValue) {
        changes[`new_${clerkField}`] = newValue
        changes[`old_${clerkField}`] = oldValue
        changedFields.push(clerkField)
      }
    }
  })

  return { changes, changedFields }
}

const sendToZapier = async (webhookUrl, payload, oldData = null) => {
  try {
    logger.info("Sending data to Zapier webhook", {
      webhookUrl,
      payloadType: payload.type,
      userId: payload.data?.id,
    })

    let dataToSend = payload

    // If it's an update and we have old data, send only the changes
    if (payload.type === "user.updated" && oldData) {
      const { changes, changedFields } = getChangedFields(oldData, payload)
      dataToSend = {
        ...payload,
        changes: changes,
        "event type": "USER_UPDATED",
        "changed fields": changedFields,
      }
    } else if (payload.type === "user.created") {
      dataToSend = {
        ...payload,
        "event type": "USER_CREATED",
      }
    }

    const response = await axios.post(webhookUrl, dataToSend)

    logger.info("Successfully sent data to Zapier", {
      status: response.status,
      webhookUrl,
      payloadType: payload.type,
      changedFields: dataToSend["changed fields"],
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

const sendUserUpdatedToZapier = async (payload, oldData) => {
  // if (!config.zapier.userUpdatedWebhookUrl) {
  //   logger.warn("No Zapier webhook URL configured for user.updated events")
  //   return
  // }

  // return sendToZapier(config.zapier.userUpdatedWebhookUrl, payload, oldData)
  return sendToZapier(
    "https://webhook.site/2c1cc6f6-21c5-43a7-946d-f3bffe86f8e5",
    payload,
    oldData
  )
}

module.exports = {
  sendUserCreatedToZapier,
  sendUserUpdatedToZapier,
}
