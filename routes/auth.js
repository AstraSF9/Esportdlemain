// routes/auth.js (sin cambios)
const express = require('express');
const router = express.Router();
const { register, login, me } = require('../controllers/authController');

router.post('/register', register);
router.post('/login', login);
router.get('/me', me);

module.exports = router;
