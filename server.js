require("dotenv").config();
const express = require("express");
const axios = require("axios");
const cors = require("cors");
const { GoogleAuth } = require("google-auth-library");
const path = require("path");

const app = express();
app.use(express.json());
app.use(cors());

// ✅ Use safe port
const PORT = process.env.PORT || 4321;

// ✅ Service account path
const SERVICE_ACCOUNT_PATH = path.join(__dirname, "serviceAccount.json");
const serviceAccount = require("./serviceAccount.json");

console.log("Service Account Project ID:", serviceAccount.project_id);
console.log("Service Account Client Email:", serviceAccount.client_email);

// Environment check
console.log("Environment Check:");
console.log("- PORT:", PORT);
console.log("- PROJECT_ID:", process.env.PROJECT_ID ? "✓ Set" : "✗ Missing");
console.log("- Service Account Path:", SERVICE_ACCOUNT_PATH);

// ✅ Health check
app.get("/", (req, res) => {
    console.log("GET / hit");
    res.json({
        status: "OK",
        message: "Server is running",
        time: new Date().toISOString()
    });
});

// ✅ Generate OAuth token (FIXED)
async function getAccessToken() {
    const auth = new GoogleAuth({
        keyFile: SERVICE_ACCOUNT_PATH,
        scopes: "https://www.googleapis.com/auth/firebase.messaging",
    });

    const client = await auth.getClient();

    const tokenResponse = await client.getAccessToken();
    const accessToken =
        typeof tokenResponse === "string"
            ? tokenResponse
            : tokenResponse.token;

    console.log("Access token length:", accessToken?.length);

    return accessToken;
}

app.post("/send-notification", async (req, res) => {
    console.log("\n=== New Request ===");
    console.log("Body:", req.body);

    const { token, title, body } = req.body;

    if (!token || !title || !body) {
        return res.status(400).json({
            success: false,
            error: "Missing required fields: token, title, body"
        });
    }

    try {
        const accessToken = await getAccessToken();

        const fcmUrl = `https://fcm.googleapis.com/v1/projects/${process.env.PROJECT_ID}/messages:send`;
        console.log("Calling FCM URL:", fcmUrl);

        const payload = {
            message: {
                token,
                notification: {
                    title,
                    body,
                },
            },
        };

        const response = await axios.post(fcmUrl, payload, {
            headers: {
               Authorization: `Bearer ${accessToken}`,
            } ,
        });

        console.log("✓ Notification sent");

        res.status(200).json({
            success: true,
            data: response.data,
        });

    } catch (error) {
        console.log("✗ FCM Error");

        if (error.response) {
            console.log("Status:", error.response.status);
            console.log("Data:", error.response.data);

            return res.status(error.response.status).json({
                success: false,
                error: error.response.data
            });
        }

        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// ✅ Force IPv4 binding (important on Mac)
app.listen(PORT, "127.0.0.1", () => {
    console.log(`\n=== Server Started ===`);
    console.log(`Server running at: http://127.0.0.1:${PORT}`);
});