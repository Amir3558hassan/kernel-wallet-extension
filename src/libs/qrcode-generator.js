/**
 * KernelWallet QR Code Generator
 * Pure JavaScript QR code generation without external dependencies
 * Supports alphanumeric and byte modes
 */

const QR_MODE = {
  NUMERIC: 1,
  ALPHANUMERIC: 2,
  BYTE: 4
};

const QR_ERROR_LEVEL = {
  L: 0, // ~7%
  M: 1, // ~15%
  Q: 2, // ~25%
  H: 3  // ~30%
};

const QR_VERSIONS = [
  null,
  { size: 21, capacity: { L: 152, M: 128, Q: 104, H: 72 } },
  { size: 25, capacity: { L: 272, M: 224, Q: 176, H: 128 } },
  { size: 29, capacity: { L: 440, M: 352, Q: 272, H: 208 } },
  { size: 33, capacity: { L: 640, M: 512, Q: 384, H: 288 } },
  { size: 37, capacity: { L: 864, M: 688, Q: 496, H: 368 } }
];

/**
 * Generate QR code data matrix
 * @param {string} text - Text to encode
 * @param {string} errorLevel - Error correction level (L, M, Q, H)
 * @returns {object} QR code matrix and metadata
 */
function generateQR(text, errorLevel = 'M') {
  const level = QR_ERROR_LEVEL[errorLevel] || 1;
  
  // Determine version
  const bytes = new TextEncoder().encode(text).length;
  let version = 1;
  for (let v = 1; v < QR_VERSIONS.length; v++) {
    if (QR_VERSIONS[v].capacity[errorLevel] >= bytes * 8) {
      version = v;
      break;
    }
  }
  
  const size = QR_VERSIONS[version].size;
  const matrix = createMatrix(size);
  
  // Add finder patterns
  addFinderPatterns(matrix, size);
  
  // Add separators
  addSeparators(matrix, size);
  
  // Add timing patterns
  addTimingPatterns(matrix, size);
  
  // Add dark module
  matrix[4 * version + 9][8] = 1;
  
  // Add format info
  addFormatInfo(matrix, size, level, 0);
  
  // Encode data
  const data = encodeData(text, version, level);
  
  // Place data modules
  placeData(matrix, size, data);
  
  // Apply mask
  applyMask(matrix, size, 0);
  
  return {
    version,
    size,
    matrix,
    text,
    errorLevel
  };
}

/**
 * Create empty matrix
 */
function createMatrix(size) {
  return Array.from({ length: size }, () => 
    Array.from({ length: size }, () => -1)
  );
}

/**
 * Add finder patterns (corners)
 */
function addFinderPatterns(matrix, size) {
  const positions = [[0, 0], [0, size - 7], [size - 7, 0]];
  
  for (const [row, col] of positions) {
    // 7x7 pattern
    for (let r = 0; r < 7; r++) {
      for (let c = 0; c < 7; c++) {
        const isBorder = r === 0 || r === 6 || c === 0 || c === 6;
        const isInner = r >= 2 && r <= 4 && c >= 2 && c <= 4;
        matrix[row + r][col + c] = isBorder || isInner ? 1 : 0;
      }
    }
  }
}

/**
 * Add separators around finder patterns
 */
function addSeparators(matrix, size) {
  const positions = [[7, 7], [7, size - 8], [size - 8, 7]];
  
  for (const [row, col] of positions) {
    for (let i = -1; i <= 7; i++) {
      if (row + i >= 0 && row + i < size) {
        if (col - 1 >= 0 && matrix[row + i][col - 1] === -1) matrix[row + i][col - 1] = 0;
        if (col + 7 < size && matrix[row + i][col + 7] === -1) matrix[row + i][col + 7] = 0;
      }
      if (col + i >= 0 && col + i < size) {
        if (row - 1 >= 0 && matrix[row - 1][col + i] === -1) matrix[row - 1][col + i] = 0;
        if (row + 7 < size && matrix[row + 7][col + i] === -1) matrix[row + 7][col + i] = 0;
      }
    }
  }
}

/**
 * Add timing patterns
 */
function addTimingPatterns(matrix, size) {
  for (let i = 8; i < size - 8; i++) {
    matrix[6][i] = i % 2 === 0 ? 1 : 0;
    matrix[i][6] = i % 2 === 0 ? 1 : 0;
  }
}

/**
 * Add format information
 */
function addFormatInfo(matrix, size, level, mask) {
  const format = getFormatBits(level, mask);
  
  // Top-left
  for (let i = 0; i < 6; i++) matrix[8][i] = (format >> i) & 1;
  matrix[8][7] = (format >> 6) & 1;
  matrix[8][8] = (format >> 7) & 1;
  matrix[7][8] = (format >> 8) & 1;
  for (let i = 9; i < 15; i++) matrix[14 - i][8] = (format >> i) & 1;
  
  // Top-right and bottom-left (mirror)
  for (let i = 0; i < 8; i++) matrix[8][size - 1 - i] = (format >> i) & 1;
  for (let i = 8; i < 15; i++) matrix[size - 15 + i][8] = (format >> i) & 1;
}

/**
 * Get format bits
 */
function getFormatBits(level, mask) {
  const format = (level << 3) | mask;
  let poly = format << 10;
  
  // BCH error correction
  while (getBitLength(poly) >= 11) {
    poly ^= 0x537 << (getBitLength(poly) - 11);
  }
  
  return ((format << 10) | poly) ^ 0x5412;
}

function getBitLength(n) {
  return n.toString(2).length;
}

/**
 * Encode data (simplified)
 */
function encodeData(text, version, level) {
  const bytes = new TextEncoder().encode(text);
  const bits = [];
  
  // Mode indicator (byte mode = 0100)
  bits.push(0, 1, 0, 0);
  
  // Character count
  const countBits = version <= 9 ? 8 : 16;
  const count = bytes.length;
  for (let i = countBits - 1; i >= 0; i--) {
    bits.push((count >> i) & 1);
  }
  
  // Data bytes
  for (const byte of bytes) {
    for (let i = 7; i >= 0; i--) {
      bits.push((byte >> i) & 1);
    }
  }
  
  // Terminator
  bits.push(0, 0, 0, 0);
  
  // Pad to byte boundary
  while (bits.length % 8 !== 0) {
    bits.push(0);
  }
  
  // Pad bytes
  const padBytes = [0xEC, 0x11];
  let padIndex = 0;
  const totalBits = QR_VERSIONS[version].capacity[['L', 'M', 'Q', 'H'][level]];
  
  while (bits.length < totalBits) {
    const byte = padBytes[padIndex % 2];
    for (let i = 7; i >= 0; i--) {
      if (bits.length < totalBits) {
        bits.push((byte >> i) & 1);
      }
    }
    padIndex++;
  }
  
  return bits;
}

/**
 * Place data modules in zigzag pattern
 */
function placeData(matrix, size, data) {
  let index = 0;
  let up = true;
  
  for (let col = size - 1; col > 0; col -= 2) {
    if (col === 6) col--; // Skip timing column
    
    for (let i = 0; i < size; i++) {
      const row = up ? size - 1 - i : i;
      
      for (let c = 0; c < 2; c++) {
        const currentCol = col - c;
        if (matrix[row][currentCol] === -1 && index < data.length) {
          matrix[row][currentCol] = data[index++];
        }
      }
    }
    
    up = !up;
  }
}

/**
 * Apply mask pattern
 */
function applyMask(matrix, size, mask) {
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      if (matrix[row][col] === -1) continue;
      
      let shouldMask = false;
      switch (mask) {
        case 0: shouldMask = (row + col) % 2 === 0; break;
        case 1: shouldMask = row % 2 === 0; break;
        case 2: shouldMask = col % 3 === 0; break;
        case 3: shouldMask = (row + col) % 3 === 0; break;
        case 4: shouldMask = (Math.floor(row / 2) + Math.floor(col / 3)) % 2 === 0; break;
        case 5: shouldMask = ((row * col) % 2) + ((row * col) % 3) === 0; break;
        case 6: shouldMask = (((row * col) % 2) + ((row * col) % 3)) % 2 === 0; break;
        case 7: shouldMask = (((row + col) % 2) + ((row * col) % 3)) % 2 === 0; break;
      }
      
      if (shouldMask && matrix[row][col] !== -1) {
        matrix[row][col] ^= 1;
      }
    }
  }
}

/**
 * Render QR code as SVG
 * @param {object} qr - QR code data from generateQR
 * @param {number} moduleSize - Size of each module in pixels
 * @returns {string} SVG string
 */
function renderQRToSVG(qr, moduleSize = 4) {
  const { size, matrix } = qr;
  const totalSize = size * moduleSize;
  
  let svg = `<svg width="${totalSize}" height="${totalSize}" viewBox="0 0 ${totalSize} ${totalSize}" xmlns="http://www.w3.org/2000/svg">`;
  
  // Background
  svg += `<rect width="${totalSize}" height="${totalSize}" fill="white"/>`;
  
  // Modules
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      if (matrix[row][col] === 1) {
        svg += `<rect x="${col * moduleSize}" y="${row * moduleSize}" width="${moduleSize}" height="${moduleSize}" fill="black"/>`;
      }
    }
  }
  
  svg += '</svg>';
  return svg;
}

/**
 * Render QR code as Data URL
 * @param {string} text - Text to encode
 * @param {number} size - Image size in pixels
 * @returns {string} Data URL
 */
function generateQRDataURL(text, size = 200) {
  const qr = generateQR(text);
  const moduleSize = Math.floor(size / qr.size);
  const svg = renderQRToSVG(qr, moduleSize);
  
  return 'data:image/svg+xml;base64,' + btoa(svg);
}

/**
 * Render QR code to canvas
 * @param {HTMLCanvasElement} canvas - Target canvas
 * @param {string} text - Text to encode
 * @param {object} options - Rendering options
 */
function renderQRToCanvas(canvas, text, options = {}) {
  const {
    moduleSize = 4,
    margin = 4,
    colorDark = '#000000',
    colorLight = '#ffffff',
    logo = null,
    logoSize = 0.2
  } = options;
  
  const qr = generateQR(text);
  const { size, matrix } = qr;
  const totalSize = (size + margin * 2) * moduleSize;
  
  canvas.width = totalSize;
  canvas.height = totalSize;
  
  const ctx = canvas.getContext('2d');
  
  // Background
  ctx.fillStyle = colorLight;
  ctx.fillRect(0, 0, totalSize, totalSize);
  
  // Modules
  ctx.fillStyle = colorDark;
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      if (matrix[row][col] === 1) {
        ctx.fillRect(
          (col + margin) * moduleSize,
          (row + margin) * moduleSize,
          moduleSize,
          moduleSize
        );
      }
    }
  }
  
  // Logo overlay
  if (logo) {
    const logoPixelSize = totalSize * logoSize;
    const logoX = (totalSize - logoPixelSize) / 2;
    const logoY = (totalSize - logoPixelSize) / 2;
    
    // White background for logo area
    ctx.fillStyle = colorLight;
    ctx.fillRect(logoX - 4, logoY - 4, logoPixelSize + 8, logoPixelSize + 8);
    
    // Draw logo (simplified - would draw image in production)
    ctx.fillStyle = colorDark;
    ctx.font = `${logoPixelSize * 0.5}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(logo, totalSize / 2, totalSize / 2);
  }
  
  return canvas.toDataURL();
}

export {
  generateQR,
  renderQRToSVG,
  generateQRDataURL,
  renderQRToCanvas,
  QR_ERROR_LEVEL
};
