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
        changedFields.push({
          field: clerkField,
          old: oldArray,
          new: newArray,
        })
      }
    } else {
      // For simple fields, compare values
      if (oldValue !== newValue) {
        changes[`new_${clerkField}`] = newValue
        changes[`old_${clerkField}`] = oldValue
        changedFields.push({
          field: clerkField,
          old: oldValue,
          new: newValue,
        })
      }
    }
  })

  logger.info("Changed fields", { changedFields }, "Changes", { changes })

  return { changes, changedFields }
}

const sendToZapier = async (webhookUrl, userDataToUpdate, user) => {
  try {
    logger.info("Sending data to Zapier webhook", {
      webhookUrl,
      payloadType: userDataToUpdate.type,
      userId: userDataToUpdate.data?.id,
    })

    let dataToSend
    logger.info(
      "User data to update inside sendToZapier",
      { userDataToUpdate },
      "User",
      { user }
    )
    // If it's an update and we have old data, send only the changes
    if (userDataToUpdate.type === "user.updated" && user) {
      const { changes, changedFields } = getChangedFields(
        user,
        userDataToUpdate
      )
      dataToSend = {
        ...userDataToUpdate,
        changes: changes,
        "event type": "USER_UPDATED",
        "changed fields": changedFields,
      }
    } else if (userDataToUpdate.type === "user.created") {
      dataToSend = {
        ...userDataToUpdate,
        "event type": "USER_CREATED",
        user: userDataToUpdate.data,
      }
    }

    logger.info("Data to send", { dataToSend })

    const response = await axios.post(webhookUrl, dataToSend)

    logger.info("Successfully sent data to Zapier", {
      status: response.status,
      webhookUrl,
      payloadType: userDataToUpdate.type,
      changedFields: dataToSend["changed fields"],
    })

    return response.data
  } catch (error) {
    logger.error("Error sending data to Zapier", {
      error: error.message,
      webhookUrl,
      payloadType: userDataToUpdate?.type,
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

const sendUserUpdatedToZapier = async (userDataToUpdate, user) => {
  logger.info("Sending user update to Zapier", {
    userDataToUpdate: JSON.stringify(userDataToUpdate),
    user: JSON.stringify(user),
  })

  return sendToZapier(
    "https://webhook.site/2c1cc6f6-21c5-43a7-946d-f3bffe86f8e5",
    userDataToUpdate,
    user
  )
}

module.exports = {
  sendUserCreatedToZapier,
  sendUserUpdatedToZapier,
}
