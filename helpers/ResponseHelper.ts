import express from "express";


export default function (
    res: express.Response,
    text: string | [] | Object,
    code: number = 200
) {
    let status = "success";
    if (code != 200) status = "error";
    res.status(code).json({
        status,
        data: text,
        code,
    });
}
