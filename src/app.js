import express from "express"
import cors from "cors"
import cookieParser from "cookie-parser"

const app = express();

app.use(cors({
  origin: process.env.CORS_ORIGIN, //orgin one of option in cors package that define origin where backend use
  credentials: true  //another option of cors package
}))

app.use(express.json({limit: "16kb"}))
app.use(express.urlencoded({extended: true, limit: "16kb"}))
app.use(express.static("public"))
app.use(cookieParser()) 

export {app}