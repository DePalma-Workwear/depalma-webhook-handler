require("dotenv").config()

// For future use
const config = {
  clerk: {
    webhookSecret: process.env.CLERK_WEBHOOK_SECRET,
  },
  supabase: {
    url: process.env.SUPABASE_URL,
    serviceKey: process.env.SUPABASE_SERVICE_KEY,
  },
  // For future use
  stripe: {
    secretKey: process.env.STRIPE_SECRET_KEY,
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
  },
  // Common settings
  environment: process.env.NODE_ENV || "development",
  isProduction: process.env.NODE_ENV === "production",
}

// Validate configuration
function validateConfig() {
  const requiredVars = [
    "clerk.webhookSecret",
    "supabase.url",
    "supabase.serviceKey",
  ]

  const missingVars = requiredVars.filter((path) => {
    const keys = path.split(".")
    let current = config
    for (const key of keys) {
      if (
        current[key] === undefined ||
        current[key] === null ||
        current[key] === ""
      ) {
        return true
      }
      current = current[key]
    }
    return false
  })

  if (missingVars.length > 0) {
    console.warn(`Missing environment variables: ${missingVars.join(", ")}`)
    return false
  }

  return true
}

config.isValid = validateConfig()

module.exports = config
