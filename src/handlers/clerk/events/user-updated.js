const logger = require("../../../utils/logger")
const { supabaseService } = require("../../../services/supabase")
const { USER_EVENT_TYPES } = require("./event-types/types")
const { isTestMode } = require("../../../utils/test-mode")

module.exports = async (payload, res) => {
  try {
    if (!payload || !payload.data) {
      throw new Error("Invalid payload: Missing data")
    }

    const { type, data } = payload

    if (type !== "user.updated") {
      logger.warn(`Unhandled event type: ${type}`)
      return {
        statusCode: 200,
        body: JSON.stringify({
          message: `Event type ${type} is not handled`,
        }),
      }
    }

    logger.info("Processing user.updated event", { userId: data.id })

    if (isTestMode(res.req)) {
      logger.info("Test mode detected, simulating user update")
      return res.status(200).json({
        success: true,
        message: "Test mode: User update simulated",
        userId: data.id,
        testMode: true,
        payload: data,
      })
    }

    await handleUserUpdated(data)

    return {
      statusCode: 200,
      body: JSON.stringify({ message: "Webhook processed successfully" }),
    }
  } catch (error) {
    logger.error("Error processing user.updated event:", error)
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: error.message || "Internal server error",
        details: error,
      }),
    }
  }
}

async function handleUserUpdated(data) {
  const { id: clerkId, external_accounts = [] } = data

  // Get user from Supabase
  const user = await supabaseService.users.getByClerkId(clerkId)

  if (!user) {
    logger.error("User not found", { clerkId })
    return
  }

  // Get existing social accounts
  const existingSocialAccounts =
    await supabaseService.socialAccounts.getByUserId(user.id)

  // Create maps for comparison
  const existingAccounts = existingSocialAccounts.reduce((acc, account) => {
    acc[`${account.provider}:${account.provider_user_id}`] = account
    return acc
  }, {})

  const newAccountsMap = external_accounts.reduce((acc, account) => {
    acc[`${account.provider}:${account.provider_user_id}`] = account
    return acc
  }, {})

  // Identify accounts to add
  const accountsToAdd = external_accounts
    .filter(
      (acc) => !existingAccounts[`${acc.provider}:${acc.provider_user_id}`]
    )
    .map((acc) => ({
      user_id: user.id,
      provider: acc.provider,
      provider_user_id: acc.provider_user_id,
      email: acc.email_address || null,
      profile_url: acc.profile_image_url || null,
    }))

  // Identify accounts to remove
  const accountIdsToRemove = existingSocialAccounts
    .filter((acc) => !newAccountsMap[`${acc.provider}:${acc.provider_user_id}`])
    .map((acc) => acc.id)

  let operationsPerformed = false

  // Add new accounts
  if (accountsToAdd.length > 0) {
    await supabaseService.socialAccounts.create(accountsToAdd)
    logger.info(`Added ${accountsToAdd.length} new social accounts`, {
      userId: user.id,
    })
    operationsPerformed = true
  }

  // Remove accounts that no longer exist
  if (accountIdsToRemove.length > 0) {
    await supabaseService.socialAccounts.deleteByIds(accountIdsToRemove)
    logger.info(`Removed ${accountIdsToRemove.length} social accounts`, {
      userId: user.id,
    })
    operationsPerformed = true
  }

  if (!operationsPerformed) {
    logger.info("No changes to social accounts", { userId: user.id })
  }

  // Create update event in activity log
  await supabaseService.activities.log(user.id, USER_EVENT_TYPES.UPDATE)
}
