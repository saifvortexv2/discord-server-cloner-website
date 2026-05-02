const { copy, stop } = require("../controllers/copy.controller");
const router = require("express").Router();
const validator = require("../middlewares/Validator");
const { copyLimiter } = require("../middlewares/rateLimiter");

router.post("/", copyLimiter, validator, copy);
router.post("/stop", stop);

module.exports = router;