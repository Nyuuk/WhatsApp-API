import dotenv from "dotenv";
import express from "express";
import WhatsApp from "./helpers/WhapsApp";
import crypto from "crypto";
import { dataMessageInterface } from "./define.md";
import ResponseHelper from "./helpers/ResponseHelper";
import multer from "multer";
import moment from "moment-timezone";

dotenv.config();

const WA = new WhatsApp();

const api = express();
const app = express();
const upload = multer({ dest: "./upload/" });
// api.use(upload.none())
app.use(upload.none())
// app.use(express.json());
// app.use(express.urlencoded({ extended: true }));
// api.use(express.json());
// api.use(express.urlencoded({ extended: true }));

// middlewate
api.use(
    (
        req: express.Request,
        res: express.Response,
        next: express.NextFunction
    ) => {
        const api_key = req.get("x-api-key");
        if (!api_key) {
            ResponseHelper(res, "x-api-key is required", 404)
            return;
        }
        if (api_key !== process.env.X_API_KEY) {
            ResponseHelper(res, "x-api-key is invalid", 404)
            return;
        }
        const secret = req.get("x-api-secret");
        if (!secret) {
            ResponseHelper(res, "x-api-secret is required", 404)
            return;
        }
        const hasSecret = crypto
            .createHash("sha256")
            .update(
                process.env.X_API_KEY +
                    req.originalUrl
                    // Math.floor(Date.now() / 1000)
            )
            .digest("hex");
        if (secret !== hasSecret) {
            ResponseHelper(res, "x-api-secret is invalid", 404)
            return;
        }
        // if (req.body.timestamp !== Math.floor(Date.now() / 1000)) {
        //     ResponseHelper(res, "timestamp is invalid", 404)
        //     return;
        // }
        next();
    }
);
api.use((req: express.Request, res: express.Response, next) => {
    // const api_key = req.get("x-api-key");
    // if (!api_key) {
    //     ResponseHelper(res, "x-api-key is required", 404)
    //     return;
    // }
    // if (api_key !== process.env.X_API_KEY) {
    //     ResponseHelper(res, "x-api-key is invalid", 404)
    //     return;
    // }

    // content type
    const contentType = req.headers['content-type'];

    if (contentType && contentType.includes('multipart/form-data')) {
        // Tangani multipart/form-data (form data)
        console.log("multipart/form-data");
        express.urlencoded({ extended: true })(req, res, next);
    } else if (contentType && contentType.includes('application/json')) {
        // Tangani application/json
        console.log("application/json");
        express.json()(req, res, next);
    } else {
        // Jika Content-Type tidak dikenali
        console.log("Unsupported Media Type");
        res.status(415).send('Unsupported Media Type');
        return;
    }
    // next();
})

app.get("/get-time", async (req: express.Request, res) => {
    ResponseHelper(res, Math.floor(Date.now() / 1000))
})

app.post("/test", async (req: express.Request, res) => {
    ResponseHelper(res, req.body)
})

api.post("/send-message", async (req: express.Request, res) => {
    const json = req.body;
    if (!json.text) {
        ResponseHelper(res, 'text is required', 404)
        return
    }
    if (!json.number) {
        ResponseHelper(res, 'number is invalid & start with 62', 404)
        return
    }
    if (!json.number.includes('@')) {
        ResponseHelper(res, 'number is invalid & start with 62 & @', 404)
        return
    }
    // const r = await WA.sendText(json.number, json.text);
    const r = await WA.addingQueueMessage(json.number, json.text);
    ResponseHelper(res, r)
});

api.post('/send-message-queue', async (req: express.Request, res) => {
    const json = req.body;
    if (!json.text) {
        ResponseHelper(res, 'text is required', 404)
        return
    }
    if (!json.number) {
        ResponseHelper(res, 'number is invalid & start with 62', 404)
        return
    }
    const r = await WA.addingQueueMessage(json.number, json.text);
    ResponseHelper(res, r)
})

api.post('/send-message-schedule', async (req: express.Request, res) => {
    const json = req.body;
    if (!json.text) {
        ResponseHelper(res, 'text is required', 404)
        return
    }
    if (!json.number) {
        ResponseHelper(res, 'number is invalid & start with 62', 404)
        return
    }
    if (!json.cron) {
        if (json.cron.length < 5) {
            ResponseHelper(res, 'cron is invalid', 404)
            return
        }
        // validasi format cron
        ResponseHelper(res, 'cron is required', 404)
        return
    }

    // const timeAsiaJakarta = moment.tz(json.date, "Asia/Jakarta").format();
    const r = await WA.addingScheduleMessage(json.number, json.text, json.cron);
    ResponseHelper(res, r)
})

api.post("/send-message-group", async (req: express.Request, res) => {
    const json = req.body;
    if (!json.text) {
        ResponseHelper(res, 'text is required', 404)
        return
    }
    if (!json.number) {
        ResponseHelper(res, 'number is invalid & start with 62', 404)
        return
    }
    try {
        // const r = await WA.client.sendMessage(json.number, {
        //     text: json.text
        // });
        const r = await WA.addingQueueMessage(json.number, json.text);
        ResponseHelper(res, r)
    } catch (error:any) {
        ResponseHelper(res, error, 404)
        return
    }
    // const r = await WA.sendGroupMessage(json.number, json.text);
});

api.get("/get-messages", async (req: express.Request, res) => {
    const json = req.query;
    const mark = json.mark === 'true' ? true : false;
    //  console.log("mark", mark, json.mark)

    const unreadMessage = await WA.prisma.message.findMany({
        where: {
            is_read: false
        }
    })
    if (mark) {
        await WA.prisma.message.updateMany({
            where: {
                is_read: false
            },
            data: {
                is_read: true
            }
        })
    }
    const unreadMessageJson = unreadMessage.map((msg) => {
        return { ...msg, msg_json: JSON.parse(msg.msg_json) }
    })
    const data = {
        data: unreadMessageJson || [],
        count: unreadMessage.length
    }
    ResponseHelper(res, data)
})

api.post("/webhook/alertmanager/:number", async (req: express.Request, res) => {
    const json = req.body;
    const number = req.params.number;
    // const number = "120363319474923598@g.us"; // Nomor WhatsApp grup/individu
    if (!number) {
        ResponseHelper(res, 'number is required ' + number, 404);
        return;
    }
    if (!json) {
        ResponseHelper(res, 'body is required', 404);
        return;
    }
    if (!json.alerts) {
        ResponseHelper(res, 'alerts is required', 404);
        return;
    }

    let messages = json.alerts.map((alert: any) => {
        const status = alert.status.toUpperCase(); // STATUS: "FIRING"/"RESOLVED"
        const instance = alert.labels.instance;
        const job = alert.labels.job;
        const severity = alert.labels.severity;
        const description = alert.annotations.description;
        const startsAt = new Date(alert.startsAt).toLocaleString();
        const endsAt = alert.status === "resolved"
            ? new Date(alert.endsAt).toLocaleString()
            : "N/A";

        return `${status} *${alert.labels.alertname}* ${status === "FIRING" ? "🔥" : "✅"}
Instance: *${instance}*
Job: *${job}*
Severity: *${severity}*
Description: *${description}*
Start Time: *${startsAt}*
End Time: *${endsAt}*`;
    }).join("\n\n");

    try {
        const result = await WA.addingQueueMessage(number, messages);
        ResponseHelper(res, result);
    } catch (error) {
        console.error("Error sending message:", error);
        ResponseHelper(res, 'Failed to send message', 500);
    }
});


// api.post("/send-some-messages", async (req: express.Request, res) => {
//     const json = req.body;
//     if (!json.data || !json.data.length) {
//         ResponseHelper(res, 'data is required & array', 404)
//         return;
//     }
//     // looping json.data
//     const dataError: dataMessageInterface[] = [];
//     const dataSuccess: { number: number }[] = [];
//     json.data.forEach(async (data: dataMessageInterface) => {
//         if (!data.text) {
//             dataError.push(data);
//             return;
//         }
//         if (!data.number) {
//             dataError.push(data);
//             return;
//         }
//         const r = await WA.sendText(data.number, data.text);
//         if (!r) {
//             dataError.push(data);
//             return;
//         }
//         dataSuccess.push({ number: data.number });
//     });
//     ResponseHelper(res, { dataError, dataSuccess }, 200)
// });

app.use("/api", api);

app.listen(process.env.APP_PORT, async () => {
    console.log("Listening on port 3000");
    WA.makeConnection();
    setTimeout(() => {
        WA.addingQueueMessage("6285156803524@s.whatsapp.net", "Server Bot API UP & RUNNING");
        WA.executeQueueMessage();
        WA.executeScheduleMessage();
    }, 5000)
});
