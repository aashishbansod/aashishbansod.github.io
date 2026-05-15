const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
require("dotenv").config();

const app = express();

/* MIDDLEWARE */

app.use(cors());
app.use(express.json());

/* ROUTES */

const authRoutes = require("./routes/authRoutes");
const examRoutes = require("./routes/examRoutes");
const leaderboardRoutes = require("./routes/leaderboardRoutes");
const resultRoutes = require("./routes/resultRoutes");
const certificateRoutes = require("./routes/certificateRoutes");

app.use("/api/auth", authRoutes);

app.use("/api/exams", examRoutes);

app.use("/api/leaderboard", leaderboardRoutes);

app.use("/api/results", resultRoutes);

app.use("/api/certificates", certificateRoutes);

/* DATABASE */

mongoose.connect(process.env.MONGO_URI)

.then(() => {

  console.log("MongoDB Connected");

})

.catch((error) => {

  console.log(error);

});

/* HOME */

app.get("/", (req, res) => {

  res.send("CyberNet Backend Running");

});

/* SERVER */

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {

  console.log(`Server Running On ${PORT}`);

});