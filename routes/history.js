const express = require("express");
const db = require("../database/db");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

router.get("/", requireAuth, async (req, res) => {
  try {
    const { search, grade, sortBy, order } = req.query;
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const offset = (page - 1) * limit;
    const userId = req.session.userId;

    const scans = await db.getHistory({ userId, search, grade, sortBy, order, limit, offset });
    const total = await db.getScanCount({ userId, search, grade });

    res.json({
      success: true,
      data: {
        scans,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    console.error("[HISTORY] Error fetching history:", error.message);
    res.status(500).json({
      success: false,
      error: { message: "Failed to retrieve scan history." },
    });
  }
});


router.delete("/:id", requireAuth, async (req, res) => {
  try {
    const result = await db.deleteScan(req.params.id, req.session.userId);

    if (result.changes === 0) {
      return res.status(404).json({
        success: false,
        error: { message: "Scan not found." },
      });
    }

    res.json({ success: true, message: "Scan deleted." });
  } catch (error) {
    console.error("[HISTORY] Error deleting scan:", error.message);
    res.status(500).json({
      success: false,
      error: { message: "Failed to delete scan." },
    });
  }
});

module.exports = router;
