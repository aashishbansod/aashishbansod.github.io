const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const User = require("../models/User");

/* REGISTER */

const register = async (req,res) => {

  try{

    const {
      fullName,
      email,
      mobile,
      college,
      course,
      password
    } = req.body;

    const existingUser = await User.findOne({email});

    if(existingUser){

      return res.status(400).json({
        message:"User already exists"
      });

    }

    const hashedPassword =
      await bcrypt.hash(password,10);

    const user = new User({

      fullName,
      email,
      mobile,
      college,
      course,
      password:hashedPassword

    });

    await user.save();

    res.status(201).json({
      message:"Registration Successful"
    });

  }

  catch(error){

    console.log(error);

    res.status(500).json({
      message:"Server Error"
    });

  }

};

/* LOGIN */

const login = async (req,res) => {

  try{

    const {
      email,
      password
    } = req.body;

    const user = await User.findOne({email});

    if(!user){

      return res.status(400).json({
        message:"User not found"
      });

    }

    const isMatch =
      await bcrypt.compare(
        password,
        user.password
      );

    if(!isMatch){

      return res.status(400).json({
        message:"Invalid Password"
      });

    }

    const token = jwt.sign(

      {
        id:user._id
      },

      process.env.JWT_SECRET,

      {
        expiresIn:"7d"
      }

    );

    res.status(200).json({

      token,

      user:{
        name:user.fullName,
        email:user.email
      }

    });

  }

  catch(error){

    console.log(error);

    res.status(500).json({
      message:"Server Error"
    });

  }

};

module.exports = {
  register,
  login
};