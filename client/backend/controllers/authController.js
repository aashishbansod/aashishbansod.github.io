import User from "../models/User.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";


// ================= REGISTER USER =================

export const registerUser = async (req, res) => {

  try {

    const {
      name,
      email,
      mobile,
      college,
      course,
      password
    } = req.body;

    // CHECK USER

    const existingUser = await User.findOne({ email });

    if (existingUser) {

      return res.status(400).json({
        message: "User already exists"
      });

    }

    // HASH PASSWORD

    const salt = await bcrypt.genSalt(10);

    const hashedPassword = await bcrypt.hash(
      password,
      salt
    );

    // CREATE USER

    const newUser = new User({
      name,
      email,
      mobile,
      college,
      course,
      password: hashedPassword
    });

    await newUser.save();

    res.status(201).json({
      message: "Registration Successful 🚀"
    });

  } catch (err) {

    console.log(err);

    res.status(500).json({
      message: "Server Error"
    });

  }

};


// ================= LOGIN USER =================

export const loginUser = async (req, res) => {

  try {

    const { email, password } = req.body;

    // FIND USER

    const user = await User.findOne({ email });

    if (!user) {

      return res.status(400).json({
        message: "User not found"
      });

    }

    // CHECK PASSWORD

    const isMatch = await bcrypt.compare(
      password,
      user.password
    );

    if (!isMatch) {

      return res.status(400).json({
        message: "Invalid Password"
      });

    }

    // CREATE TOKEN

    const token = jwt.sign(
      { id: user._id },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.status(200).json({
      message: "Login Successful 🚀",
      token,
      user
    });

  } catch (err) {

    console.log(err);

    res.status(500).json({
      message: "Server Error"
    });

  }

};
