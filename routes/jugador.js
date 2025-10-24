const express = require('express');
const router = express.Router();
const { adivinarJugador } = require('../controllers/jugadorController');

router.post('/', adivinarJugador);

module.exports = router;
