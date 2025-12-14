// require('dotenv').config({path: ',/env'});
import dotenv from "dotenv"


import connectDB from "./db/index.js"
import {app} from "./app.js"

dotenv.config({
  path: './env'
})

connectDB()
.then(() => {

  app.on("error" , (error) => {
    console.log("ERROR: " , error);
    throw error
  })
  
  app.listen(process.env.PORT || 8000, () => {
    console.log(`Server is running at port : ${process.env.PORT}`);
  })
})
.catch((err) => {
  console.log("MONGO db connection failed !!! " , err);
})













// First approach for connecting database where all function code write in index file directly without separating code in another file.
/*
import express from "express"

const app = express()


;(async () => {
  try{
    await mongoose.connect(`${process.env.MONGODB_URL}/${DB_NAME}`)
    app.on("error" , (error)=>{     //listener who are listening errors here
      console.log("Error:" , error);
      throw error
    })
    
    app.listen(process.env.PORT , () => {
      console.log(`App is listening on port ${process.env.PORT}`);
    })
  }
  catch(error){
    console.log("ERROR : " , error)
    throw err
  }
})()
  */