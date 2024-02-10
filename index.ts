import dotenv from "dotenv";
import express from "express";
import WhatsApp from "./helpers/WhapsApp";
import crypto from "crypto";

dotenv.config();

// const WA = new WhatsApp();
// WA.makeConnection();

const api = express();
api.use(express.json());
api.use(express.urlencoded({ extended: true }));

// middlewate
api.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
    const api_key = req.get('x-api-key');
    if (!api_key) {
        res.status(404).json({
            message: "x-api-key is required",
            status: "error",
        })
        return
    }
    if (api_key !== process.env.X_API_KEY) {
        res.status(404).json({
            message: "x-api-key is invalid",
            status: "error",
        })
        return
    }
    const secret= req.get('x-api-secret');
    if (!secret) {
        res.status(404).json({
            message: "x-api-secret is required",
            status: "error",
        })
        return;
    }
    const hasSecret = crypto.createHash('sha256').update(process.env.X_API_KEY + req.originalUrl + Math.floor(Date.now() / 1000)).digest('hex');
    if (secret !== hasSecret) {
        res.status(404).json({
            message: "x-api-secret is invalid",
            status: "error",
        })
        return
    }
    if (req.body.timestamp !== Math.floor(Date.now() / 1000)) {
        res.status(404).json({
            message: "timestamp is invalid",
            status: "error",
        })
        return
    }
    next();
})

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
    const json = req.body;
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
    // const r = await WA.sendText(json.number, json.text);
    res.json({ message: "success" });
});

api.listen(3000, async () => {
    console.log("Listening on port 3000");
});