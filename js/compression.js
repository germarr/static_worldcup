/**
 * Compression abstraction with native CompressionStream support and pako fallback
 * Uses 'deflate' format (zlib with header/checksum) to match pako's default output
 */

const Compression = (() => {
  const supportsNative = typeof CompressionStream !== 'undefined' && typeof DecompressionStream !== 'undefined';
  let pakoLoaded = false;
  let pakoLoadPromise = null;

  /**
   * Lazy-load pako fallback when needed
   */
  const loadPako = () => {
    if (pakoLoaded) return Promise.resolve();
    if (pakoLoadPromise) return pakoLoadPromise;

    pakoLoadPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'js/vendor/pako.min.js';
      script.onload = () => {
        pakoLoaded = true;
        resolve();
      };
      script.onerror = () => reject(new Error('Failed to load pako fallback'));
      document.head.appendChild(script);
    });

    return pakoLoadPromise;
  };

  /**
   * Compress string using native CompressionStream
   */
  const compressNative = async (str) => {
    const encoder = new TextEncoder();
    const data = encoder.encode(str);
    const cs = new CompressionStream('deflate');
    const writer = cs.writable.getWriter();
    writer.write(data);
    writer.close();

    const chunks = [];
    const reader = cs.readable.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }

    const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
    const result = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of chunks) {
      result.set(chunk, offset);
      offset += chunk.length;
    }
    return result;
  };

  /**
   * Decompress bytes using native DecompressionStream
   */
  const decompressNative = async (bytes) => {
    const ds = new DecompressionStream('deflate');
    const writer = ds.writable.getWriter();
    writer.write(bytes);
    writer.close();

    const chunks = [];
    const reader = ds.readable.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }

    const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
    const result = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of chunks) {
      result.set(chunk, offset);
      offset += chunk.length;
    }

    const decoder = new TextDecoder();
    return decoder.decode(result);
  };

  /**
   * Compress string using pako fallback
   */
  const compressPako = async (str) => {
    await loadPako();
    return window.pako.deflate(str);
  };

  /**
   * Decompress bytes using pako fallback
   */
  const decompressPako = async (bytes) => {
    await loadPako();
    return window.pako.inflate(bytes, { to: 'string' });
  };

  /**
   * Initialize compression - pre-load pako if native not supported
   */
  const initCompression = async () => {
    if (!supportsNative) {
      await loadPako();
    }
  };

  /**
   * Compress a string to Uint8Array
   */
  const compress = supportsNative ? compressNative : compressPako;

  /**
   * Decompress a Uint8Array to string
   */
  const decompress = supportsNative ? decompressNative : decompressPako;

  return {
    supportsNative,
    initCompression,
    compress,
    decompress,
  };
})();

// Export for use in other scripts
window.Compression = Compression;
