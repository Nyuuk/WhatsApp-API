import dotenv from "dotenv";
import express from "express";
import WhatsApp from "./helpers/WhapsApp";

dotenv.config();

const WA = new WhatsApp();
WA.makeConnection();

const api = express();
api.use(express.json());
api.use(express.urlencoded({ extended: true }));

api.get("/ping", (req, res) => {
    res.send("pong");
});
api.post("/test", (req, res) => {
    const headers = req.headers;
    const body = req.body;
    res.send({
        headers,
        body,
    });
});

api.post("/send-message", async (req: express.Request, res) => {
    const now = Math.floor(Date.now() / 1000);
    const json = req.body;
    const headers = req.headers;
    if (!headers["x-api-key"]) {
        res.status(404).json({
            message: "x-api-key is required",
            status: "error",
        });
        return;
    }
    if (headers["x-api-key"] != process.env.X_API_KEY) {
        res.status(404).json({
            message: "x-api-key is invalid",
            status: "error",
        });
        return;
    }

    if (!Object.keys(json).includes("timestamp")) {
        res.status(404).json({
            message: "timestamp is required",
            timestamp: now,
            status: "error",
            body: json,
        });
        return;
    }
    if (json.timestamp != now) {
        res.status(404).json({
            message: "timestamp is invalid",
            timestamp: now,
            status: "error",
            body: json,
        });
        return;
    }
    if (!json.text) {
        res.status(404).json({
            message: "text is required",
            status: "error",
            body: json,
        });
        return;
    }
    if (!json.number) {
        res.status(404).json({
            message: "number is invalid && start with 62",
            status: "error",
            body: json,
        });
        return;
    }
    const r = await WA.sendText(json.number, json.text);
    res.json({ r });
});

api.listen(3000, async () => {
    console.log("Listening on port 3000");
});

const apps = async () => {
    const qrTerminal = process.env.QR_TERMINAL === "true";
    // const phoneNumber: string = process.env.PHONE_NUMBER || "6285156803524";
    // console.log(phoneNumber);
    const { state, saveCreds } = await useMultiFileAuthState(
        process.env.SESSION_NAME || "session"
    );

    const client = makeWASocket({
        auth: state,
        logger: P({ level: "silent" }),
        printQRInTerminal: true,
    });

    client.ev.on("connection.update", async (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === "close") {
            const shouldReconnect =
                (lastDisconnect?.error as Boom)?.output?.statusCode !==
                DisconnectReason.loggedOut;
            console.log(
                "connection closed due to ",
                lastDisconnect?.error,
                ", reconnecting ",
                shouldReconnect
            );
            // reconnect if not logged out
            if (shouldReconnect) {
                apps();
            }
        } else if (connection === "open") {
            console.log("opened connection");
            // const sntMsg = await client.sendMessage("6285156803524@c.us", {
            //     text: "Hello World!",
            // });
            // console.log(sntMsg);

            // make api
        }
    });

    client.ev.on("creds.update", saveCreds);
};
