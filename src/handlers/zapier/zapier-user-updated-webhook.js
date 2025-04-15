const logger = require("../../utils/logger")
const axios = require("axios")
const config = require("../../config")

function findChangedFields(oldData, newData) {
  const changes = {}

  // Find common keys between oldData and newData
  const commonKeys = Object.keys(oldData).filter((key) => key in newData)

  commonKeys.forEach((key) => {
    const oldValue = oldData[key]
    const newValue = newData[key]

    if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
      // Simplify specific complex fields
      if (key === "email_addresses") {
        changes[key] = {
          old: oldValue.map((email) => email.email_address),
          new: newValue.map((email) => email.email_address),
        }
      } else if (key === "external_accounts") {
        changes[key] = {
          old: oldValue,
          new: newValue,
        }
      } else {
        changes[key] = {
          old: oldValue,
          new: newValue,
        }
      }
    }
  })

  return changes
}

async function sendUserUpdatedToZapier(payload, newData, oldData) {
  try {
    // Manipulate external_accounts before comparison
    const manipulatedNewData = {
      ...newData,
      external_accounts:
        newData.external_accounts?.map((account) => ({
          provider: account.provider,
          email: account.email_address,
          provider_user_id: account.provider_user_id,
          first_name: account.first_name,
          last_name: account.last_name,
        })) || [],
    }

    const manipulatedOldData = {
      ...oldData,
      external_accounts:
        oldData.external_accounts?.map((account) => ({
          provider: account.provider,
          email: account.email,
          provider_user_id: account.provider_user_id,
          first_name: account.first_name,
          last_name: account.last_name,
        })) || [],
    }

    const changes = findChangedFields(manipulatedOldData, manipulatedNewData)

    const zapierPayload = {
      USER_UPDATE: {
        changes: changes,
        metadata: {
          timestamp: new Date().toISOString(),
          user_id: newData.id,
        },
      },
    }

    const response = await axios.post(
      "https://webhook.site/936c8c6f-b0bf-4b30-9bd8-2ff8731f1b7e",
      zapierPayload
    )

    logger.info("Successfully sent user update to Zapier", {
      userId: newData.id,
      changes: Object.keys(changes),
    })

    return response.data
  } catch (error) {
    logger.error("Failed to send user update to Zapier", {
      error: error.message,
      userId: newData.id,
    })
    throw error
  }
}

module.exports = {
  sendUserUpdatedToZapier,
}
