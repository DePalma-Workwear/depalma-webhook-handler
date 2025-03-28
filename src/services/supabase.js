const { createClient } = require("@supabase/supabase-js")
const config = require("../config")
const logger = require("../utils/logger")

// Create Supabase client
const supabase = createClient(config.supabase.url, config.supabase.serviceKey)

// Wrapper with logging for Supabase operations
const supabaseService = {
  // User services
  users: {
    // Create a new user
    create: async (userData) => {
      logger.debug("Creating new user in Supabase", {
        clerkId: userData.clerkId,
      })
      const { data, error } = await supabase.from("users").insert(userData)

      if (error) {
        logger.error("Error creating user", error)
        throw error
      }

      return data
    },

    // Get user by clerkId
    getByClerkId: async (clerkId) => {
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
    // Create social accounts for user
    create: async (accounts) => {
      if (!accounts || accounts.length === 0) return []

      logger.debug("Saving social accounts", { count: accounts.length })
      const { data, error } = await supabase
        .from("user_social_accounts")
        .insert(accounts)

      if (error) {
        logger.error("Error creating social accounts", error)
        throw error
      }

      return data
    },
  },
}

module.exports = supabaseService
