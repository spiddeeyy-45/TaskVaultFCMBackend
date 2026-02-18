require("dotenv").config();
const express = require("express");
const axios = require("axios");
const cors = require("cors");
const { GoogleAuth } = require("google-auth-library");

const app = express();
app.use(express.json());
app.use(cors());

const PORT = process.env.PORT || 4321;

app.get("/", (req, res) => {
    console.log(" Health check endpoint hit");
    res.json({
        status: "OK",
        message: "Server is running",
        time: new Date().toISOString()
    });
});

async function getAccessToken() {

    console.log(" Generating OAuth access token...");

    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

    const auth = new GoogleAuth({
        credentials: serviceAccount,
        scopes: ["https://www.googleapis.com/auth/firebase.messaging"],
    });

    const client = await auth.getClient();
    const tokenResponse = await client.getAccessToken();

    const accessToken = typeof tokenResponse === "string"
        ? tokenResponse
        : tokenResponse.token;

    console.log(" Access token generated (length):", accessToken?.length);

    return accessToken;
}

app.post("/send-notification", async (req, res) => {

    console.log("\n ===== New Notification Request =====");
    console.log("Request Body:", req.body);

    const { token, title, body, type, senderUid } = req.body;

    if (!token || !title || !body) {
        console.log(" Missing required fields");
        return res.status(400).json({
            success: false,
            error: "Missing required fields"
        });
    }

    try {

        const accessToken = await getAccessToken();

        const payload = {
            message: {
                token,
                notification: {
                    title,
                    body,
                },
                data: {
                    type: type || "general",
                    senderUid: senderUid || ""
                }
            }
        };

        console.log(" Sending payload to FCM...");
        console.log("FCM URL:",
            `https://fcm.googleapis.com/v1/projects/${process.env.PROJECT_ID}/messages:send`
        );

        const response = await axios.post(
            `https://fcm.googleapis.com/v1/projects/${process.env.PROJECT_ID}/messages:send`,
            payload,
            {
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                },
            }
        );

        console.log(" Notification successfully sent!");
        console.log("FCM Response:", response.data);

        res.status(200).json({
            success: true,
            data: response.data
        });

    } catch (error) {

        console.log(" FCM ERROR OCCURRED");

        if (error.response) {
            console.log("Status:", error.response.status);
            console.log("Error Data:", error.response.data);
        } else {
            console.log("Error Message:", error.message);
        }

        res.status(500).json({
            success: false,
            error: error.response?.data || error.message
        });
    }
});

app.listen(PORT, () => {
    console.log("=================================");
    console.log(` Server running on port ${PORT}`);
    console.log("=================================");
});
