const logger = require("../../../utils/logger")
const { v4: uuidv4 } = require("uuid")
const { supabaseService } = require("../../../services/supabase")
const { USER_EVENT_TYPES } = require("./event-types/types")
const { isTestMode } = require("../../../utils/test-mode")

module.exports = async (payload, res) => {
  try {
    if (!payload || !payload.data) {
      throw new Error("Invalid payload: Missing data")
    }

    logger.info("Processing user.created event", { userId: payload.data.id })
    const uniqueGlobalId = uuidv4()

    if (isTestMode(res.req)) {
      logger.info("Test mode detected, simulating user creation")
      return res.status(200).json({
        success: true,
        message: "Test mode: User creation simulated",
        userId: payload.data.id,
        testMode: true,
        payload: payload.data,
      })
    }

    // Extract data from Clerk webhook
    const data = payload.data
    const {
      id,
      email_addresses = [],
      first_name,
      last_name,
      username,
      external_accounts = [],
    } = data

    // Validate required fields
    if (!id) {
      throw new Error("Missing required field: id")
    }

    // Prepare user data for Supabase
    const userDataToInsert = {
      clerkId: id,
      email: email_addresses?.[0]?.email_address || "default@example.com",
      firstName: first_name,
      lastName: last_name,
      created_at: new Date().toISOString(),
      username: username,
      unique_global_id: uniqueGlobalId,
    }

    logger.info("Saving user to Supabase", {
      clerkId: userDataToInsert.clerkId,
      email: userDataToInsert.email,
    })

    // Try to save the user
    const newUser = await supabaseService.users.create(userDataToInsert)

    if (!newUser) {
      throw new Error("Failed to create user in Supabase")
    }

    // Skapa signup activity in activity log
    await supabaseService.activities.log(newUser.id, USER_EVENT_TYPES.SIGNUP)

    // Save social accounts if they exist
    if (external_accounts && external_accounts.length > 0) {
      const socialAccountsToInsert = external_accounts.map((account) => ({
        user_id: newUser.id,
        provider: account.provider,
        provider_user_id: account.provider_user_id,
        email: account.email_address || null,
        profile_url: account.profile_image_url || null,
      }))

      await supabaseService.socialAccounts.create(socialAccountsToInsert)
    }

    logger.info("User creation completed successfully", {
      userId: newUser.id,
      clerkId: id,
      hasExternalAccounts: external_accounts.length > 0,
    })

    // Return success response
    return {
      statusCode: 200,
      body: JSON.stringify({
        message: "User saved to Supabase",
        uniqueGlobalId: uniqueGlobalId,
      }),
    }
  } catch (error) {
    logger.error("Error processing user.created event:", error)
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: error.message || "Internal server error",
        details: error,
      }),
    }
  }
}
