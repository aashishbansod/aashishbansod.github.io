"use strict";

const Certificate = require("../models/Certificate");
const Student = require("../models/Student");

/*
|--------------------------------------------------------------------------
| Helpers
|--------------------------------------------------------------------------
*/

function normalizeId(value) {
  return String(value || "").trim().toUpperCase();
}

/*
|--------------------------------------------------------------------------
| ISSUE CERTIFICATE (ADMIN)
|--------------------------------------------------------------------------
*/

const issueCertificate = async (req, res) => {
  try {
    const {
      studentId,
      internshipTitle,
      internshipDomain,
      internshipDuration,
      certificateType = "Internship",
      grade = "A",
      score = 0,
      xpEarned = 0,
    } = req.body;

    if (!studentId || !internshipTitle) {
      return res.status(400).json({
        success: false,
        message: "Student ID and internship title are required",
      });
    }

    const student = await Student.findById(studentId);

    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student not found",
      });
    }

    const existingCertificate =
      await Certificate.findOne({
        student: student._id,
        internshipTitle,
        status: "Issued",
      });

    if (existingCertificate) {
      return res.status(409).json({
        success: false,
        message: "Certificate already issued",
        certificate: existingCertificate,
      });
    }

    const certificate = await Certificate.create({
      student: student._id,
      studentName: `${student.firstName} ${student.lastName}`.trim(),
      studentEmail: student.email,
      studentPhone: student.mobile,
      college: student.college,
      course: student.course,
      year: student.year,
      internshipTitle,
      internshipDomain,
      internshipDuration,
      certificateType,
      grade,
      score,
      xpEarned,
    });

    student.certificateIssued = true;
    student.certificateEligible = true;
    student.certificateId =
      certificate.certificateId;
    student.certificateIssuedDate =
      new Date();

    await student.save();

    return res.status(201).json({
      success: true,
      message:
        "Certificate issued successfully",
      certificate,
    });
  } catch (error) {
    console.error(
      "Issue Certificate Error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        error.message ||
        "Failed to issue certificate",
    });
  }
};

/*
|--------------------------------------------------------------------------
| VERIFY CERTIFICATE
|--------------------------------------------------------------------------
*/

const verifyCertificate = async (
  req,
  res
) => {
  try {
    const certificateId = normalizeId(
      req.params.certificateId
    );

    const certificate =
      await Certificate.findOne({
        certificateId,
      }).populate(
        "student",
        "firstName lastName email"
      );

    if (!certificate) {
      return res.status(404).json({
        success: false,
        verified: false,
        message:
          "Certificate not found",
      });
    }

    if (
      typeof certificate.incrementVerification ===
      "function"
    ) {
      await certificate.incrementVerification();
    }

    return res.status(200).json({
      success: true,
      verified:
        certificate.status ===
        "Issued",
      certificate,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message:
        error.message ||
        "Verification failed",
    });
  }
};

/*
|--------------------------------------------------------------------------
| VERIFY USING CODE
|--------------------------------------------------------------------------
*/

const verifyCertificateByCode =
  async (req, res) => {
    try {
      const verificationCode =
        normalizeId(
          req.body.verificationCode
        );

      if (!verificationCode) {
        return res.status(400).json({
          success: false,
          message:
            "Verification code is required",
        });
      }

      const certificate =
        await Certificate.findOne({
          verificationCode,
        });

      if (!certificate) {
        return res.status(404).json({
          success: false,
          verified: false,
          message:
            "Certificate not found",
        });
      }

      if (
        typeof certificate.incrementVerification ===
        "function"
      ) {
        await certificate.incrementVerification();
      }

      return res.status(200).json({
        success: true,
        verified:
          certificate.status ===
          "Issued",
        certificate,
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  };

/*
|--------------------------------------------------------------------------
| GET CERTIFICATE
|--------------------------------------------------------------------------
*/

const getCertificateById =
  async (req, res) => {
    try {
      const certificate =
        await Certificate.findOne({
          certificateId:
            normalizeId(
              req.params.certificateId
            ),
        });

      if (!certificate) {
        return res.status(404).json({
          success: false,
          message:
            "Certificate not found",
        });
      }

      return res.status(200).json({
        success: true,
        certificate,
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message:
          error.message,
      });
    }
  };

/*
|--------------------------------------------------------------------------
| STUDENT CERTIFICATES
|--------------------------------------------------------------------------
*/

const getStudentCertificates =
  async (req, res) => {
    try {
      const certificates =
        await Certificate.find({
          student: req.user.id,
        }).sort({
          createdAt: -1,
        });

      return res.status(200).json({
        success: true,
        count: certificates.length,
        certificates,
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message:
          error.message,
      });
    }
  };

/*
|--------------------------------------------------------------------------
| DOWNLOAD CERTIFICATE
|--------------------------------------------------------------------------
*/

const downloadCertificate =
  async (req, res) => {
    try {
      const certificate =
        await Certificate.findOne({
          certificateId:
            normalizeId(
              req.params.certificateId
            ),
        });

      if (!certificate) {
        return res.status(404).json({
          success: false,
          message:
            "Certificate not found",
        });
      }

      if (
        req.user.role !== "admin" &&
        String(certificate.student) !==
          String(req.user.id)
      ) {
        return res.status(403).json({
          success: false,
          message:
            "Access denied",
        });
      }

      if (
        typeof certificate.incrementDownload ===
        "function"
      ) {
        await certificate.incrementDownload();
      }

      return res.status(200).json({
        success: true,
        downloadUrl:
          certificate.pdfUrl,
        certificate,
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message:
          error.message,
      });
    }
  };

/*
|--------------------------------------------------------------------------
| COMPANY VERIFICATION
|--------------------------------------------------------------------------
*/

const companyVerification =
  async (req, res) => {
    try {
      const {
        certificateId,
        companyName,
      } = req.body;

      const certificate =
        await Certificate.findOne({
          certificateId:
            normalizeId(
              certificateId
            ),
        });

      if (!certificate) {
        return res.status(404).json({
          success: false,
          verified: false,
        });
      }

      if (
        typeof certificate.incrementVerification ===
        "function"
      ) {
        await certificate.incrementVerification(
          {
            companyName,
            ipAddress:
              req.ip,
            userAgent:
              req.headers[
                "user-agent"
              ],
          }
        );
      }

      return res.status(200).json({
        success: true,
        verified:
          certificate.status ===
          "Issued",
        certificate,
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message:
          error.message,
      });
    }
  };

/*
|--------------------------------------------------------------------------
| REVOKE CERTIFICATE
|--------------------------------------------------------------------------
*/

const revokeCertificate =
  async (req, res) => {
    try {
      const { reason } =
        req.body;

      const certificate =
        await Certificate.findOne({
          certificateId:
            normalizeId(
              req.params.certificateId
            ),
        });

      if (!certificate) {
        return res.status(404).json({
          success: false,
          message:
            "Certificate not found",
        });
      }

      if (
        typeof certificate.revoke ===
        "function"
      ) {
        await certificate.revoke(
          reason
        );
      } else {
        certificate.status =
          "Revoked";
        certificate.revocationReason =
          reason || "";
        await certificate.save();
      }

      return res.status(200).json({
        success: true,
        message:
          "Certificate revoked successfully",
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message:
          error.message,
      });
    }
  };

/*
|--------------------------------------------------------------------------
| ANALYTICS
|--------------------------------------------------------------------------
*/

const getCertificateAnalytics =
  async (req, res) => {
    try {
      const [
        total,
        issued,
        revoked,
        verificationData,
      ] = await Promise.all([
        Certificate.countDocuments(),
        Certificate.countDocuments({
          status: "Issued",
        }),
        Certificate.countDocuments({
          status: "Revoked",
        }),
        Certificate.aggregate([
          {
            $group: {
              _id: null,
              total: {
                $sum:
                  "$verificationCount",
              },
            },
          },
        ]),
      ]);

      return res.status(200).json({
        success: true,
        analytics: {
          totalCertificates:
            total,
          activeCertificates:
            issued,
          revokedCertificates:
            revoked,
          totalVerifications:
            verificationData[0]
              ?.total || 0,
        },
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message:
          error.message,
      });
    }
  };

module.exports = {
  issueCertificate,
  verifyCertificate,
  verifyCertificateByCode,
  getCertificateById,
  getStudentCertificates,
  downloadCertificate,
  companyVerification,
  revokeCertificate,
  getCertificateAnalytics,
};