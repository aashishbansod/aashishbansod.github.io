const express = require("express");

const router = express.Router();

const {

  createCertificate,
  getCertificates

} = require(
  "../controllers/certificateController"
);

router.post("/",
createCertificate);

router.get("/",
getCertificates);

module.exports = router;