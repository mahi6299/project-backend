import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";

const app = express();

app.use(
  cors({
    origin: process.env.CORS_ORIGIN, //orgin one of option in cors package that define origin where backend use
    credentials: true, //another option of cors package
  })
);

app.use(express.json({ limit: "16kb" }));
app.use(express.urlencoded({ extended: true, limit: "16kb" }));
app.use(express.static("public"));
app.use(cookieParser());

// routes

import userRouter from "./routes/user.routes.js";

// routes declaration
app.use("/api/v1/users", userRouter); //standard practice including api version also

//make url path as: https://localhost:8000/users and https://localhost:8000/users/register and https://localhost:8000/users/login

export { app };
