/**
 * In-memory FAISS-like vector store for per-session RAG.
 * Uses brute-force cosine similarity (no native FAISS dependency for portability).
 * For production with large documents, swap to faiss-node or a cloud vector DB.
 */
class QuizVectorStore {
    /**
     * @param {number} dimension - Embedding dimension (1536 for text-embedding-3-small)
     */
    constructor(dimension = 1536) {
        this.dimension = dimension;
        this.vectors = [];
        this.metadata = [];
    }

    /**
     * Add chunks and their embeddings to the store.
     * 
     * @param {Array<{text: string, chunkIndex: number, pageApprox: number}>} chunks
     * @param {Float32Array[]} embeddings
     */
    async addChunks(chunks, embeddings) {
        if (chunks.length !== embeddings.length) {
            throw new Error('Chunks and embeddings arrays must have the same length');
        }

        for (let i = 0; i < chunks.length; i++) {
            this.vectors.push(embeddings[i]);
            this.metadata.push({
                text: chunks[i].text,
                chunkIndex: chunks[i].chunkIndex,
                pageApprox: chunks[i].pageApprox
            });
        }
    }

    /**
     * Find the top-k most similar chunks to the query embedding.
     * Uses cosine similarity.
     * 
     * @param {Float32Array} queryEmbedding
     * @param {number} k - Number of results to return
     * @returns {Promise<Array<{text: string, chunkIndex: number, pageApprox: number, score: number}>>}
     */
    async similaritySearch(queryEmbedding, k = 5) {
        if (this.vectors.length === 0) {
            return [];
        }

        const scores = this.vectors.map((vec, idx) => ({
            index: idx,
            score: cosineSimilarity(queryEmbedding, vec)
        }));

        scores.sort((a, b) => b.score - a.score);

        const topK = scores.slice(0, Math.min(k, scores.length));

        return topK.map(item => ({
            ...this.metadata[item.index],
            score: item.score
        }));
    }

    /**
     * Get the number of vectors stored.
     * @returns {number}
     */
    get size() {
        return this.vectors.length;
    }
}

/**
 * Calculate cosine similarity between two vectors.
 * @param {Float32Array} a
 * @param {Float32Array} b
 * @returns {number} Similarity score between -1 and 1
 */
function cosineSimilarity(a, b) {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
        dotProduct += a[i] * b[i];
        normA += a[i] * a[i];
        normB += b[i] * b[i];
    }

    const denominator = Math.sqrt(normA) * Math.sqrt(normB);
    if (denominator === 0) return 0;

    return dotProduct / denominator;
}

module.exports = { QuizVectorStore };
