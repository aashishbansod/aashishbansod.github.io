const Certificate =
require("../models/Certificate");

/* CREATE CERTIFICATE */

exports.createCertificate =
async (req,res)=>{

  try{

    const {

      studentName,
      examTitle,
      percentage

    } = req.body;

    const certificateId =
    "CYBER-" +
    Math.floor(
      100000 + Math.random()*900000
    );

    const newCertificate =
    new Certificate({

      studentName,
      examTitle,
      percentage,
      certificateId

    });

    await newCertificate.save();

    res.status(201).json({

      success:true,

      certificate:newCertificate

    });

  }

  catch(error){

    res.status(500).json({

      success:false,
      message:error.message

    });

  }

};

/* GET CERTIFICATES */

exports.getCertificates =
async(req,res)=>{

  try{

    const certificates =
    await Certificate.find();

    res.status(200).json({

      success:true,
      certificates

    });

  }

  catch(error){

    res.status(500).json({

      success:false,
      message:error.message

    });

  }

};