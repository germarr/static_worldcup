/**
 * Compression abstraction using pako for consistent zlib format
 * Always uses pako to ensure compatibility with existing URL data
 */

const Compression = (() => {
  /**
   * Check if pako is available
   */
  const ensurePako = () => {
    if (typeof window.pako === 'undefined') {
      throw new Error('pako library not loaded. Include pako.min.js before compression.js');
    }
  };

  /**
   * Compress string using pako (zlib format)
   */
  const compress = async (str) => {
    ensurePako();
    return window.pako.deflate(str);
  };

  /**
   * Decompress bytes using pako (zlib format)
   */
  const decompress = async (bytes) => {
    ensurePako();
    return window.pako.inflate(bytes, { to: 'string' });
  };

  /**
   * Initialize compression - verify pako is loaded
   */
  const initCompression = async () => {
    ensurePako();
  };

  return {
    supportsNative: false,
    initCompression,
    compress,
    decompress,
  };
})();

// Export for use in other scripts
window.Compression = Compression;
