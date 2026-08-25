const pdf = require('pdf-parse');

/**
 * Parse PDF buffer and chunk into ~500-token segments with 50-token overlap.
 * Uses a sliding window approach over words (approx 1 word ≈ 1.3 tokens).
 * 
 * @param {Buffer} buffer - PDF file buffer from multer
 * @returns {Promise<Array<{text: string, chunkIndex: number, pageApprox: number}>>}
 */
async function chunkPdf(buffer) {
    const data = await pdf(buffer);
    const fullText = data.text;

    if (!fullText || fullText.trim().length === 0) {
        throw new Error('PDF contains no extractable text');
    }

    const totalPages = data.numpages || 1;
    const words = fullText.split(/\s+/).filter(w => w.length > 0);

    // ~500 tokens ≈ ~385 words (1 token ≈ 0.75 words on average)
    const CHUNK_SIZE_WORDS = 385;
    const OVERLAP_WORDS = 38; // ~50 tokens overlap

    const chunks = [];
    let startIdx = 0;
    let chunkIndex = 0;

    while (startIdx < words.length) {
        const endIdx = Math.min(startIdx + CHUNK_SIZE_WORDS, words.length);
        const chunkWords = words.slice(startIdx, endIdx);
        const text = chunkWords.join(' ');

        // Approximate which page this chunk belongs to
        const charPosition = fullText.indexOf(chunkWords[0]);
        const pageApprox = Math.min(
            Math.ceil((charPosition / fullText.length) * totalPages),
            totalPages
        ) || 1;

        chunks.push({
            text,
            chunkIndex,
            pageApprox
        });

        chunkIndex++;

        // Move the window forward (subtract overlap)
        if (endIdx >= words.length) break;
        startIdx = endIdx - OVERLAP_WORDS;
    }

    return chunks;
}

module.exports = { chunkPdf };
