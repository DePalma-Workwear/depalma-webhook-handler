const logger = require("../../../utils/logger")
const { createClient } = require("@supabase/supabase-js")
const config = require("../../../config")
const { USER_EVENT_TYPES } = require("./event-types/types")
const { isTestMode } = require("../../../utils/test-mode")
const {
  sendUserUpdatedToZapier,
} = require("../../zapier/zapier-user-updated-webhook")

// Create Supabase client
const supabase = createClient(config.supabase.url, config.supabase.serviceKey)

module.exports = async (payload, res, webhookSecret) => {
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

    logger.info("Processing user.updated event", {
      userId: data.id,
      webhookSecret: webhookSecret ? "present" : "missing",
    })

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

    const result = await handleUserUpdated(data, payload)

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

async function handleUserUpdated(data, payload) {
  const {
    id: clerkId,
    email_addresses = [],
    first_name,
    last_name,
    username,
    external_accounts = [],
  } = data

  logger.info("Processing user.updated event in handleUserUpdated", {
    userId: clerkId,
  })

  // Get user from Supabase
  const { data: user, error: userError } = await supabase
    .from("users")
    .select("*")
    .eq("clerkId", clerkId)
    .single()

  if (userError && userError.code !== "PGRST116") {
    logger.error("Error getting user by clerkId", userError)
    throw userError
  }

  if (!user) {
    logger.info("User not found in Supabase, skipping update", { clerkId })
    return
  }

  // Get old social accounts from Supabase
  const { data: oldSocialAccounts, error: oldSocialAccountsError } =
    await supabase
      .from("user_social_accounts")
      .select("*")
      .eq("user_id", user.id)

  if (oldSocialAccountsError) {
    logger.error("Error getting old social accounts", oldSocialAccountsError)
    throw oldSocialAccountsError
  }

  // Prepare data to send to Zapier
  const oldData = {
    first_name: user.firstName,
    last_name: user.lastName,
    email_addresses: user.email ? [{ email_address: user.email }] : [],
    external_accounts: oldSocialAccounts || [],
  }

  // Prepare user data for update
  const userDataToUpdate = {
    email: email_addresses?.[0]?.email_address || user.email,
    firstName: first_name || user.firstName,
    lastName: last_name || user.lastName,
    username: username || user.username,
    updated_at: new Date().toISOString(),
  }

  // Update user information
  // Update user information in Supabase
  const { data: updatedUser, error: updateError } = await supabase
    .from("users")
    .update(userDataToUpdate)
    .eq("clerkId", clerkId)
    .select()
    .single()

  if (updateError) {
    logger.error("Error updating user", updateError)
    throw updateError
  }

  if (!updatedUser) {
    logger.error("Failed to update user", { clerkId })
    return
  }

  // Send to Zapier with both old and new data
  try {
    await sendUserUpdatedToZapier(payload, data, oldData)
    logger.info("Successfully sent user.updated data to Zapier", {
      userId: data.id,
    })
  } catch (zapierError) {
    logger.error("Failed to send data to Zapier", {
      error: zapierError,
      userId: data.id,
    })
  }

  // Get existing social accounts
  const { data: existingSocialAccounts, error: existingSocialAccountsError } =
    await supabase
      .from("user_social_accounts")
      .select("*")
      .eq("user_id", user.id)

  if (existingSocialAccountsError) {
    logger.error("Error getting social accounts", existingSocialAccountsError)
    throw existingSocialAccountsError
  }

  // Create maps for comparison
  const existingAccounts = (existingSocialAccounts || []).reduce(
    (acc, account) => {
      acc[`${account.provider}:${account.provider_user_id}`] = account
      return acc
    },
    {}
  )

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
  const accountIdsToRemove = (existingSocialAccounts || [])
    .filter((acc) => !newAccountsMap[`${acc.provider}:${acc.provider_user_id}`])
    .map((acc) => acc.id)

  let operationsPerformed = false

  // Add new accounts
  if (accountsToAdd.length > 0) {
    logger.info("Attempting to add social accounts:", {
      accounts: accountsToAdd,
      count: accountsToAdd.length,
    })

    const { error: createError, data: createdAccounts } = await supabase
      .from("user_social_accounts")
      .insert(accountsToAdd)
      .select()

    if (createError) {
      logger.error("Error creating social accounts", {
        error: createError,
        accounts: accountsToAdd,
      })
      throw createError
    }

    logger.info(`Added ${accountsToAdd.length} new social accounts`, {
      userId: user.id,
      addedAccounts: createdAccounts,
    })
    operationsPerformed = true
  }

  // Remove accounts that no longer exist
  if (accountIdsToRemove.length > 0) {
    const { error: deleteError } = await supabase
      .from("user_social_accounts")
      .delete()
      .in("id", accountIdsToRemove)

    if (deleteError) {
      logger.error("Error deleting social accounts", deleteError)
      throw deleteError
    }

    logger.info(`Removed ${accountIdsToRemove.length} social accounts`, {
      userId: user.id,
    })
    operationsPerformed = true
  }

  if (!operationsPerformed) {
    logger.info("No changes to social accounts", { userId: user.id })
  }

  // Create update event in activity log
  const { error: activityError } = await supabase
    .from("user_activitie_log")
    .insert([
      {
        active_user: user.id,
        type_of_activity: USER_EVENT_TYPES.UPDATE,
      },
    ])

  if (activityError) {
    logger.error("Error logging user activity", activityError)
    throw activityError
  }
}
