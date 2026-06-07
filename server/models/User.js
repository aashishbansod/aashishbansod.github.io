const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
{
    fullName: {
        type: String,
        required: true,
        trim: true,
    },

    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true,
    },

    password: {
        type: String,
        required: true,
    },

    role: {
        type: String,
        enum: ["student", "admin", "mentor"],
        default: "student",
    },

    phone: {
        type: String,
        default: "",
    },

    college: {
        type: String,
        default: "",
    },

    course: {
        type: String,
        default: "",
    },

    city: {
        type: String,
        default: "",
    },

    profileImage: {
        type: String,
        default: "",
    },

    assessmentScore: {
        type: Number,
        default: 0,
    },

    scholarshipPercentage: {
        type: Number,
        default: 0,
    },

    internshipDomain: {
        type: String,
        default: "",
    },

    internshipStatus: {
        type: String,
        enum: [
            "Not Applied",
            "Applied",
            "Selected",
            "Rejected",
            "Completed",
        ],
        default: "Not Applied",
    },

    internshipStartDate: {
        type: Date,
    },

    internshipEndDate: {
        type: Date,
    },

    completedTasks: {
        type: Number,
        default: 0,
    },

    totalTasks: {
        type: Number,
        default: 0,
    },

    certificateIssued: {
        type: Boolean,
        default: false,
    },

    certificateId: {
        type: String,
        default: "",
    },

    githubLink: {
        type: String,
        default: "",
    },

    linkedinLink: {
        type: String,
        default: "",
    },

    isVerified: {
        type: Boolean,
        default: false,
    },
},
{
    timestamps: true,
}
);

module.exports = mongoose.model("User", userSchema);