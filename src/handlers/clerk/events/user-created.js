const logger = require("../../../utils/logger")
const { v4: uuidv4 } = require("uuid")
const { createClient } = require("@supabase/supabase-js")
const config = require("../../../config")
const { USER_EVENT_TYPES } = require("./event-types/types")
const { isTestMode } = require("../../../utils/test-mode")
const { sendUserCreatedToZapier } = require("../../zapier/zapier-webhooks")

// Create Supabase client
const supabase = createClient(config.supabase.url, config.supabase.serviceKey)

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

    // Kolla om användaren redan finns i Supabase
    const { data: existingUser, error: checkError } = await supabase
      .from("users")
      .select("*")
      .eq("clerkId", id)
      .single()

    if (checkError && checkError.code !== "PGRST116") {
      logger.error("Error checking for existing user", checkError)
      throw checkError
    }

    if (existingUser) {
      logger.info("User already exists in Supabase, skipping creation", {
        userId: existingUser.id,
        clerkId: id,
      })
      return {
        statusCode: 200,
        body: JSON.stringify({
          message: "User already exists in Supabase",
          userId: existingUser.id,
        }),
      }
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
    const { data: newUser, error: userError } = await supabase
      .from("users")
      .insert(userDataToInsert)
      .select()
      .single()

    if (userError) {
      logger.error("Error creating user in Supabase", userError)
      throw userError
    }

    if (!newUser) {
      throw new Error("Failed to create user in Supabase")
    }

    // Create signup event in activity log
    const { error: activityError } = await supabase
      .from("user_activitie_log")
      .insert([
        {
          active_user: newUser.id,
          type_of_activity: USER_EVENT_TYPES.SIGNUP,
        },
      ])

    if (activityError) {
      logger.error("Error logging user activity", activityError)
      throw activityError
    }

    // Save social accounts if they exist
    if (external_accounts && external_accounts.length > 0) {
      const socialAccountsToInsert = external_accounts.map((account) => ({
        user_id: newUser.id,
        provider: account.provider,
        provider_user_id: account.provider_user_id,
        email: account.email_address || null,
        profile_url: account.profile_image_url || null,
      }))

      const { error: socialAccountsError } = await supabase
        .from("user_social_accounts")
        .insert(socialAccountsToInsert)

      if (socialAccountsError) {
        logger.error("Error creating social accounts", socialAccountsError)
        throw socialAccountsError
      }
    }

    logger.info("User creation completed successfully", {
      userId: newUser.id,
      clerkId: id,
      hasExternalAccounts: external_accounts.length > 0,
    })

    // Send data to Zapier
    try {
      await sendUserCreatedToZapier(payload)
      logger.info("Successfully sent user.created data to Zapier", {
        userId: newUser.id,
      })
    } catch (zapierError) {
      logger.error("Failed to send data to Zapier", {
        error: zapierError,
        userId: newUser.id,
      })
      // Don't throw the error as we don't want to fail the whole process
    }

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
