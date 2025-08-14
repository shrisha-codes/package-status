const mongoose = require("mongoose");

// Schema for individual comment entries
const commentEntrySchema = new mongoose.Schema({
  user: { type: String, default: "Current User" },
  text: { type: String, required: true },
  timestamp: { type: Date, default: Date.now }
});

const packageSchema = new mongoose.Schema(
  {
    packageName: String,
    imageNames: String,
    binaryNames: String,
    distroSuccess: String,
    distroFailure: String,
    successTime: Date,
    failureTime: Date,
    status: String,
    owner: String,

    // Legacy single comment
    comment: String,

    // New fields
    latest_comment: String,
    comments: {
      BI: { type: [commentEntrySchema], default: [] },
      CI: { type: [commentEntrySchema], default: [] },
      Image: { type: [commentEntrySchema], default: [] },
      Binary: { type: [commentEntrySchema], default: [] },
      Docker: { type: [commentEntrySchema], default: [] }
    },

    // Fixed naming for consistency with frontend
    biBroken: { type: Boolean, default: false },
    dockerBroken: { type: Boolean, default: false },
    imageBroken: { type: Boolean, default: false },
    binaryBroken: { type: Boolean, default: false },
    ciBroken: { type: Boolean, default: false },

    imageSize: String,
  },
  { timestamps: true }
);

module.exports = mongoose.model("Package", packageSchema);