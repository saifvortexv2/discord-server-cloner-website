const { copy } = require("../controllers/copy.controller");
const router = require("express").Router();
const validator = require("../middlewares/Validator");

router.post("/", validator, copy);

module.exports = router;