const { createClient } = require("@supabase/supabase-js")
const config = require("../config")
const logger = require("../utils/logger")
const USER_EVENT_TYPES = require("../handlers/clerk/events/event-types/types")

// Log Supabase configuration
logger.info("Initializing Supabase client with config:", {
  url: config.supabase.url,
  hasServiceKey: !!config.supabase.serviceKey,
  environment: config.environment,
  isProduction: config.isProduction,
})

// Create Supabase client
const supabase = createClient(config.supabase.url, config.supabase.serviceKey)

// Test Supabase connection
supabase
  .from("users")
  .select("count")
  .limit(0)
  .then(({ data, error }) => {
    if (error) {
      logger.error("Failed to connect to Supabase:", {
        error,
        url: config.supabase.url,
        environment: config.environment,
      })
    } else {
      logger.info("Successfully connected to Supabase", {
        data,
        environment: config.environment,
      })
    }
  })
  .catch((error) => {
    logger.error("Unexpected error testing Supabase connection:", {
      error,
      url: config.supabase.url,
      environment: config.environment,
    })
  })

// Wrapper with logging for Supabase operations
const supabaseService = {
  // User services
  users: {
    // Create a new user
    create: async (userData) => {
      logger.debug("Creating new user in Supabase", {
        clerkId: userData.clerkId,
        email: userData.email,
        environment: config.environment,
      })

      if (!userData || !userData.clerkId) {
        logger.error("Invalid user data:", {
          receivedData: userData,
          environment: config.environment,
        })
        throw new Error("Invalid user data: Missing required fields")
      }

      try {
        // Check if user already exists
        const { data: existingUser } = await supabase
          .from("users")
          .select("id, clerkId")
          .eq("clerkId", userData.clerkId)
          .single()

        if (existingUser) {
          logger.info("User already exists in Supabase:", {
            userId: existingUser.id,
            clerkId: existingUser.clerkId,
          })
          return existingUser
        }

        // First insert the user without returning data
        const { error: insertError } = await supabase
          .from("users")
          .insert(userData)

        if (insertError) {
          // If error is about unique constraint, user was created in a concurrent request
          if (insertError.code === "23505") {
            const { data: concurrentUser } = await supabase
              .from("users")
              .select("id, clerkId")
              .eq("clerkId", userData.clerkId)
              .single()

            if (concurrentUser) {
              logger.info("User was created concurrently:", {
                userId: concurrentUser.id,
                clerkId: concurrentUser.clerkId,
              })
              return concurrentUser
            }
          }

          logger.error("Supabase error creating user:", {
            error: insertError,
            userData: {
              clerkId: userData.clerkId,
              email: userData.email,
            },
          })
          throw insertError
        }

        // Use the inserted user data if available
        if (insertedUser && insertedUser.length > 0) {
          const newUser = insertedUser[0]
          logger.info("User created successfully in Supabase:", {
            userId: newUser.id,
            clerkId: userData.clerkId,
            email: userData.email,
            environment: config.environment,
          })

          try {
            await supabaseService.activities.log(
              newUser.id,
              USER_EVENT_TYPES.SIGNUP
            )
            logger.info("User activity logged successfully", {
              userId: newUser.id,
              activityType: USER_EVENT_TYPES.SIGNUP,
            })
          } catch (activityError) {
            logger.error("Failed to log user activity", {
              error: activityError,
              userId: newUser.id,
            })
          }

          return newUser
        } else {
          logger.error("No user data returned after insert", {
            clerkId: userData.clerkId,
            environment: config.environment,
          })
          throw new Error("User created but no data returned")
        }
      } catch (error) {
        logger.error("Unexpected error in create user:", error)
        throw error
      }
    },

    // Get user by clerkId
    getByClerkid: async (clerkId) => {
      logger.debug("Getting user from Supabase", { clerkId })
      const { data, error } = await supabase
        .from("users")
        .select("*")
        .eq("clerkId", clerkId)
        .single()

      if (error) {
        logger.error("Error getting user by clerkId", error)
        throw error
      }

      return data
    },
  },

  // User activity
  activities: {
    // Log user activity
    log: async (userId, activityType) => {
      logger.debug("Logging user activity", { userId, activityType })
      const { data, error } = await supabase.from("user_activitie_log").insert([
        {
          active_user: userId,
          type_of_activity: activityType,
        },
      ])

      if (error) {
        logger.error("Error logging user activity", error)
        throw error
      }

      return data
    },
  },

  // Social accounts
  socialAccounts: {
    create: async (accounts) => {
      logger.debug("Creating social accounts", { count: accounts.length })
      const { data, error } = await supabase
        .from("user_social_accounts")
        .insert(accounts)

      if (error) {
        logger.error("Error creating social accounts", error)
        throw error
      }

      return data
    },

    // Update social accounts for a user
    update: async (userId, accounts) => {
      logger.debug("Updating social accounts", {
        userId,
        count: accounts.length,
      })

      // First delete existing accounts
      await supabase.from("user_social_accounts").delete().eq("user_id", userId)

      // Then insert new ones
      const { data, error } = await supabase
        .from("user_social_accounts")
        .insert(accounts)

      if (error) {
        logger.error("Error updating social accounts", error)
        throw error
      }

      return data
    },
  },
}

module.exports = { supabaseService }
