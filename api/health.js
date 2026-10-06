"use strict";
const { timingSafeEqual } = require("node:crypto");
module.exports = async function (req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "GET") return res.status(405).json({ error: "只支持GET" });
  const code = process.env.APP_ACCESS_CODE;
  if (!code)
    return res
      .status(503)
      .json({ error: "部署存在，但尚未设置访问码及模型参数。" });
  const a = Buffer.from(String(req.headers["x-app-access"] || "")),
    b = Buffer.from(code);
  if (a.length !== b.length || !timingSafeEqual(a, b))
    return res.status(401).json({ error: "应用访问码不正确。" });
  const ready = ["MODEL_API_KEY", "MODEL_BASE_URL", "MODEL_NAME"].every(
    (k) => !!process.env[k],
  );
  return res
    .status(ready ? 200 : 503)
    .json(
      ready
        ? { message: "服务端已部署，四项配置存在；尚未进行付费模型调用。" }
        : { error: "模型服务参数不完整，请检查三项 MODEL_ 环境变量。" },
    );
};
