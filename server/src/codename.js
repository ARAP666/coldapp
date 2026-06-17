// Codename generator for FRÍA members.
// Format: WORD-NN where WORD is from a curated pool and NN is 10..99.
// All ASCII so it survives URL params and JSON without surprises.

const WORDS = [
  'BRAVO', 'TIGRE', 'NIEVE', 'RAYO', 'LUNA', 'NORTE', 'SUR', 'ESTE',
  'OESTE', 'FUEGO', 'AGUA', 'VIENTO', 'PIEDRA', 'HIERRO', 'PLATA', 'ORO',
  'LENTO', 'RAPIDO', 'FRIO', 'CALOR', 'NUEVO', 'VIEJO', 'ALTO', 'BAJO',
  'FUERTE', 'SUAVE', 'CLARO', 'OSCURO', 'COBRE', 'ACERO', 'MARMOL',
  'ROBLE', 'PINO', 'CEDRO', 'OLIVO', 'SAUCE', 'PALMA', 'ROSAL',
  'AZUCAR', 'MIEL', 'SAL', 'CANELA', 'ANIS', 'ROMERO', 'TOMILLO',
  'GRIS', 'CAFE', 'BRONCE', 'RUBIO', 'NEGRO', 'BLANCO', 'VERDE',
  'ROJO', 'AZUL', 'AMARILLO', 'ROSA', 'MARCA', 'CLAVO', 'COMINO',
  'PIMIENTA', 'FRESNO', 'HAYA',
];

const CODENAME_RE = /^[A-Z]{3,7}-\d{2}$/;

function pickWord(rng) {
  const r = rng ?? Math.random;
  return WORDS[Math.floor(r() * WORDS.length)];
}

function pickNumber(rng) {
  const r = rng ?? Math.random;
  // 10..99 inclusive.
  return 10 + Math.floor(r() * 90);
}

// Build one codename. Use the supplied rng for deterministic tests.
function buildCodename(rng) {
  return `${pickWord(rng)}-${String(pickNumber(rng)).padStart(2, '0')}`;
}

// Generate a codename that does not collide with `existing` (a Set of strings).
// Throws after MAX_ATTEMPTS so we don't infinite-loop on a full room.
function generateUniqueCodename(existing, { rng, maxAttempts = 50 } = {}) {
  for (let i = 0; i < maxAttempts; i++) {
    const cn = buildCodename(rng);
    if (!existing.has(cn)) return cn;
  }
  throw new Error('no codename available — room is full');
}

// Returns true if `s` looks like a codename we generated.
function isCodename(s) {
  return typeof s === 'string' && CODENAME_RE.test(s);
}

module.exports = {
  WORDS,
  buildCodename,
  generateUniqueCodename,
  isCodename,
};
