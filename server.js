import express from "express";
import { rateLimiter } from "./rateLimiter.js";

const app = express();

app.use(rateLimiter);

app.get("/", (req, res) => {
  res.send("API is working");
});

app.listen(3000, () => {
  console.log("Server running on port 3000");
});