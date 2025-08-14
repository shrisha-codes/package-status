

const express = require("express");
const Package = require("../models/Package");
const router = express.Router();

/**
 * Helper: recompute latest comment & type
 */
function updateLatestComment(pkg) {
  const allComments = Object.entries(pkg.comments || {})
    .flatMap(([build, arr]) =>
      (arr || []).map(c => ({
        ...c,
        build
      }))
    )
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  if (allComments.length > 0) {
    pkg.latest_build_type = allComments[0].build;
    pkg.latest_comment = allComments[0].text;
  } else {
    pkg.latest_build_type = null;
    pkg.latest_comment = null;
  }
}

/**
 * GET all packages
 */
router.get("/", async (req, res) => {
  try {
    const packages = await Package.find();
    res.json(packages);
  } catch (err) {
    console.error("Error fetching packages:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * GET single package by ID
 */
router.get("/:id", async (req, res) => {
  try {
    const pkg = await Package.findById(req.params.id);
    if (!pkg) return res.status(404).json({ error: "Package not found" });
    res.json(pkg);
  } catch (err) {
    console.error("Error fetching package:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * POST add new comment
 */
router.post("/:id/comments", async (req, res) => {
  try {
    const { buildType, text } = req.body;
    if (!buildType || !text) {
      return res.status(400).json({ error: "buildType and text are required" });
    }

    const normalizedType = buildType.replace(" Build", "").trim();

    const pkg = await Package.findById(req.params.id);
    if (!pkg) return res.status(404).json({ error: "Package not found" });

    pkg.comments ||= {};
    pkg.comments[normalizedType] ||= [];

    pkg.comments[normalizedType].push({
      text,
      user: "Current User", // Replace with actual user if you have auth
      timestamp: new Date()
    });

    updateLatestComment(pkg);
    await pkg.save();

    res.status(201).json(pkg);
  } catch (err) {
    console.error("Error adding comment:", err);
    res.status(500).json({ error: "Error adding comment" });
  }
});

/**
 * PUT edit comment
 */
router.put("/:id/comments/edit", async (req, res) => {
  try {
    const { type, text, timestamp } = req.body;
    if (!type || !text || !timestamp) {
      return res.status(400).json({ error: "type, text, and timestamp are required" });
    }

    const pkg = await Package.findById(req.params.id);
    if (!pkg) return res.status(404).json({ error: "Package not found" });

    const commentsArray = pkg.comments?.[type];
    if (!Array.isArray(commentsArray)) {
      return res.status(400).json({ error: "Invalid build type" });
    }

    const comment = commentsArray.find(
      c => new Date(c.timestamp).getTime() === new Date(timestamp).getTime()
    );
    if (!comment) return res.status(404).json({ error: "Comment not found" });

    comment.text = text;

    updateLatestComment(pkg);
    await pkg.save();

    res.json(pkg);
  } catch (err) {
    console.error("Error editing comment:", err);
    res.status(500).json({ error: "Error editing comment" });
  }
});

/**
 * DELETE comment
 */
router.delete("/:id/comments/delete", async (req, res) => {
  try {
    const { type, timestamp } = req.body;
    if (!type || !timestamp) {
      return res.status(400).json({ error: "type and timestamp are required" });
    }

    const pkg = await Package.findById(req.params.id);
    if (!pkg) return res.status(404).json({ error: "Package not found" });

    if (!pkg.comments?.[type]) {
      return res.status(400).json({ error: "Invalid build type" });
    }

    pkg.comments[type] = pkg.comments[type].filter(
      c => new Date(c.timestamp).getTime() !== new Date(timestamp).getTime()
    );

    updateLatestComment(pkg);
    await pkg.save();

    res.json(pkg);
  } catch (err) {
    console.error("Error deleting comment:", err);
    res.status(500).json({ error: "Error deleting comment" });
  }
});

/**
 * PUT update image size
 */
router.put("/:id/image-size", async (req, res) => {
  try {
    const { imageSize } = req.body;
    if (!imageSize) {
      return res.status(400).json({ error: "imageSize is required" });
    }

    const pkg = await Package.findById(req.params.id);
    if (!pkg) return res.status(404).json({ error: "Package not found" });

    pkg.imageSize = imageSize;
    await pkg.save();

    res.json(pkg);
  } catch (err) {
    console.error("Error updating image size:", err);
    res.status(500).json({ error: "Error updating image size" });
  }
});

/**
 * PUT update broken state
 */
router.put("/:id/broken-state", async (req, res) => {
  try {
    const pkg = await Package.findById(req.params.id);
    if (!pkg) return res.status(404).json({ error: "Package not found" });

    const keyMapping = {
      broken: "biBroken",       // fixed mapping
      dockerBroken: "dockerBroken",
      imageBroken: "imageBroken",
      binaryBroken: "binaryBroken",
      cibroken: "ciBroken"
    };

    let updated = false;
    for (const [uiKey, dbKey] of Object.entries(keyMapping)) {
      if (req.body[uiKey] !== undefined) {
        pkg[dbKey] = req.body[uiKey];
        updated = true;
      }
    }

    if (!updated) {
      return res.status(400).json({ error: "No valid fields to update" });
    }

    await pkg.save();
    res.json(pkg);
  } catch (err) {
    console.error("Error updating broken state:", err);
    res.status(500).json({ error: "Error updating broken state" });
  }
});

module.exports = router;