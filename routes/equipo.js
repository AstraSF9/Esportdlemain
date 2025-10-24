const express = require('express');
const router = express.Router();
const { adivinarEquipo } = require('../controllers/equipoController');

router.post('/', adivinarEquipo);

module.exports = router;
