import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { ZodError } from "zod";
import "./db/index.js";
import { seedDatabase } from "./db/seed.js";

seedDatabase();

void startJobQueue(processGenerationJob);
import { AppError } from "./lib/errors.js";
import { ensureUploadDir, getUploadDir } from "./lib/storage.js";
import { requireAuth } from "./middleware/auth.js";
import { auth } from "./routes/auth.js";
import { user } from "./routes/user.js";
import { sessions } from "./routes/sessions.js";
import { assets } from "./routes/assets.js";
import { ai } from "./routes/ai.js";
import { productSetAuthed, productSetPublic } from "./routes/productSet.js";
import { tools } from "./routes/tools.js";
import { product, productWebhook } from "./routes/product.js";
import { processGenerationJob } from "./lib/jobs.js";
import { startJobQueue, getQueueStatus } from "./lib/queue/index.js";
import { getPaymentStatus } from "./lib/payment/index.js";
import { getVideoProviderStatus } from "./providers/video/registry.js";
import { sign } from "./routes/sign.js";
import { invite } from "./routes/invite.js";
import { noticeAuthed, noticePublic } from "./routes/notice.js";
import { versionPublic } from "./routes/version.js";
import { brandKit } from "./routes/brandKit.js";
import { admin } from "./routes/admin.js";

ensureUploadDir();

const app = new Hono();

const corsOrigin = process.env.CORS_ORIGIN ?? "http://localhost:3000";

app.use(
  "*",
  cors({
    origin: corsOrigin,
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization", "X-Admin-Secret"],
  }),
);

app.onError((err, c) => {
  if (err instanceof AppError) {
    return c.json(
      { error: { code: err.code, message: err.message } },
      err.status as 400,
    );
  }
  if (err instanceof ZodError) {
    return c.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: err.errors[0]?.message ?? "参数错误",
        },
      },
      400,
    );
  }
  console.error(err);
  return c.json(
    { error: { code: "INTERNAL_ERROR", message: "服务器错误" } },
    500,
  );
});

app.get("/health", (c) =>
  c.json({ ok: true, service: "aimarket-api", version: "0.5.0" }),
);

app.use(
  "/uploads/*",
  serveStatic({
    root: getUploadDir(),
    rewriteRequestPath: (p) => p.replace(/^\/uploads/, ""),
  }),
);

app.route("/api/v1/product/webhook", productWebhook);

app.route("/api/v1/auth", auth);
app.route("/api/v1/productSet", productSetPublic);
app.route("/api/v1/notice", noticePublic);
app.route("/api/v1/version", versionPublic);
app.route("/api/v1/admin", admin);

const authed = new Hono();
authed.use("*", requireAuth);
authed.route("/user", user);
authed.route("/imageSession", sessions);
authed.route("/assets", assets);
authed.route("/ai", ai);
authed.route("/productSet", productSetAuthed);
authed.route("/tools", tools);
authed.route("/product", product);
authed.route("/sign", sign);
authed.route("/inviteUser", invite);
authed.route("/notice", noticeAuthed);
authed.route("/brandKit", brandKit);

app.route("/api/v1", authed);

const port = Number(process.env.PORT ?? 4000);

serve({ fetch: app.fetch, port }, () => {
  console.log(`AIMarket API v0.6 listening on http://localhost:${port}`);
});
