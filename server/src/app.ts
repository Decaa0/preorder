import express from "express";
export function createApp() {
  const app = express();
  app.use((_req, res) => res.status(501).json({ error: { code: "NOT_IMPLEMENTED", message: "not implemented" } }));
  return app;
}
