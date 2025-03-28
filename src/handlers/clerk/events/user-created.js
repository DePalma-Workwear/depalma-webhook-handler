const logger = require("../../../utils/logger")
const { v4: uuidv4 } = require("uuid")
const { supabaseClient } = require("../../../services/supabase")
const { USER_EVENT_TYPES } = require("./event-types/types")
const { isTestMode } = require("../../../utils/test-mode")

module.exports = async (payload, res) => {
  try {
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

    logger.info("Saving user to Supabase", userDataToInsert)

    // Try to save the user
    const { error } = await supabaseClient
      .from("users")
      .insert(userDataToInsert)

    if (error) {
      logger.error("Supabase error:", error)
      return res.status(500).json({
        error: "Error saving user to Supabase",
        details: error,
      })
    }

    // Get the new user's Supabase ID
    const { data: newUser, error: fetchError } = await supabaseClient
      .from("users")
      .select("id")
      .eq("clerkId", id)
      .single()

    if (fetchError) {
      logger.error("Error fetching new user:", fetchError)
    } else {
      // Skapa signup activity in activity log
      await supabaseClient.from("user_activitie_log").insert([
        {
          active_user: newUser.id,
          type_of_activity: USER_EVENT_TYPES.SIGNUP,
        },
      ])

      // Save social accounts if they exist
      if (external_accounts && external_accounts.length > 0) {
        const socialAccountsToInsert = external_accounts.map((account) => ({
          user_id: newUser.id,
          provider: account.provider,
          provider_user_id: account.provider_user_id,
          email: account.email_address || null,
          profile_url: account.profile_image_url || null,
        }))

        await supabaseClient
          .from("user_social_accounts")
          .insert(socialAccountsToInsert)
      }
    }

    // Return success response
    return res.status(200).json({
      success: true,
      message: "User creation processed",
      userId: id,
    })
  } catch (error) {
    logger.error("Error processing user.created event:", error)
    throw error // Let the main handler handle the error
  }
}
