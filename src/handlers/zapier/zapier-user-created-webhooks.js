const axios = require("axios")
const logger = require("../../utils/logger")

// Temporär URL för testning
const webhookUrl = "https://webhook.site/936c8c6f-b0bf-4b30-9bd8-2ff8731f1b7e"

async function sendToZapier(payload, type) {
  try {
    logger.info("Sending data to Zapier", { type })

    if (!webhookUrl) {
      throw new Error("Webhook URL is not configured")
    }

    // Manipulate external_accounts to only include specific fields
    const manipulatedExternalAccounts = (
      payload.data.external_accounts || []
    ).map((account) => ({
      provider: account.provider,
      strategy: account.strategy,
      external_account_id: account.external_account_id,
      email_address: account.email_address,
      google_id: account.google_id || null,
      provider_user_id: account.provider_user_id,
      first_name: account.first_name,
      last_name: account.last_name,
    }))

    const userData = {
      type,
      clerkId: payload.data.id,
      email: payload.data.email_addresses[0].email_address,
      firstName: payload.data.first_name,
      lastName: payload.data.last_name,
      username: payload.data.username,
      externalAccounts: manipulatedExternalAccounts,
      createdAt: payload.data.created_at,
      updatedAt: payload.data.updated_at,
      clerk_org_id: payload.data.clerk_org_id,
      organization_name: payload.data.organization_name,
      unique_global_id: payload.data.unique_global_id || null,
    }

    const dataToSend = {
      NEW_USER_CREATED: userData,
    }

    logger.info("Sending payload to Zapier", { dataToSend })

    const response = await axios.post(webhookUrl, dataToSend)
    logger.info("Successfully sent data to Zapier", {
      status: response.status,
      data: response.data,
    })

    return response.data
  } catch (error) {
    logger.error("Error sending data to Zapier:", {
      error: error.message,
      stack: error.stack,
      payload: payload,
    })
    throw error
  }
}

async function sendUserCreatedToZapier(payload) {
  try {
    logger.info("Sending user.created event to Zapier", {
      userId: payload.data.id,
    })
    return await sendToZapier(payload, "user.created")
  } catch (error) {
    logger.error("Failed to send user.created event to Zapier:", {
      error: error.message,
      stack: error.stack,
    })
    throw error
  }
}

async function sendUserUpdatedToZapier(payload, oldData) {
  try {
    logger.info("Sending user.updated event to Zapier", {
      userId: payload.data.id,
      hasOldData: !!oldData,
    })
    return await sendToZapier(payload, "user.updated")
  } catch (error) {
    logger.error("Failed to send user.updated event to Zapier:", {
      error: error.message,
      stack: error.stack,
    })
    throw error
  }
}

module.exports = {
  sendUserCreatedToZapier,
  sendUserUpdatedToZapier,
}
