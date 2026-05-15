import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";

import authRoutes from "./routes/authRoutes.js";

dotenv.config();

const app = express();


// MIDDLEWARE

app.use(cors());

app.use(express.json());


// DATABASE CONNECTION

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB Connected"))
  .catch((err) => console.log(err));


// ROUTES

app.use("/api/auth", authRoutes);


// TEST ROUTE

app.get("/", (req, res) => {

  res.send("CyberNet Backend Running 🚀");

});


// SERVER

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {

  console.log(`Server Running on ${PORT}`);

});