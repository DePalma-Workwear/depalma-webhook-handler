const fs = require("fs")
const path = require("path")
const axios = require("axios")

// Configure which test to run
const testName = process.argv[2] || "user-created"
// Configure which service to test (clerk, stripe, etc.)
const service = process.argv[3] || "clerk"
//NOTE: Make sure you are using the correct port in local testing
const webhookUrl = "http://localhost:50240/.netlify/functions/webhook"

// Set development mode to simulate verification process
process.env.NODE_ENV = "development"

async function runTest() {
  console.log("Calling URL:", webhookUrl)
  // Read test payload
  const payloadPath = path.join(
    __dirname,
    "../../test-payloads",
    `${testName}.json`
  )
  if (!fs.existsSync(payloadPath)) {
    console.error(`Test payload not found: ${payloadPath}`)
    process.exit(1)
  }

  const payload = fs.readFileSync(payloadPath, "utf8")

  console.log(`Sending ${service} ${testName} test to webhook...`)

  // Create basic headers
  const headers = {
    "Content-Type": "application/json",
    "x-test-mode": "true",
  }

  // Add service-specific headers
  //Add more if needed
  switch (service) {
    case "clerk":
      headers["x-webhook-source"] = "clerk"
      headers["svix-id"] = "test_id"
      headers["svix-timestamp"] = new Date().toISOString()
      headers["svix-signature"] = "test_signature"
      break
    case "stripe":
      headers["x-webhook-source"] = "stripe"
      headers["stripe-signature"] = "test_signature"
      break
    default:
      headers["x-webhook-source"] = service
  }

  try {
    // Skicka request till webhook
    const response = await axios.post(webhookUrl, payload, { headers })

    console.log("Response:", {
      status: response.status,
      data: response.data,
    })
  } catch (error) {
    console.error(
      "Error:",
      error.response
        ? {
            status: error.response.status,
            data: error.response.data,
          }
        : error.message
    )
  }
}

runTest()
