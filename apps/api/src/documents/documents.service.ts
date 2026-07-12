import { BadRequestException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Pool } from 'pg';
import { PG_POOL } from '../database/database.module';
import { EmbeddingsService } from '../embeddings/embeddings.service';
import { chunkPages } from './chunking';
import { isPdfBuffer, parsePdf } from './pdf';
import { toSqlVector } from '../shared/vector';

export interface DocumentRecord {
  id: string;
  filename: string;
  pages: number;
  chunks: number;
  createdAt: string;
}

@Injectable()
export class DocumentsService {
  private readonly logger = new Logger(DocumentsService.name);

  constructor(
    @Inject(PG_POOL) private readonly pool: Pool,
    private readonly embeddings: EmbeddingsService,
  ) {}

  async create(filename: string, buffer: Buffer): Promise<DocumentRecord> {
    if (!isPdfBuffer(buffer)) {
      throw new BadRequestException('The uploaded file is not a valid PDF');
    }

    let parsed;
    try {
      parsed = await parsePdf(buffer);
    } catch (error) {
      this.logger.warn(`Failed to parse PDF "${filename}": ${(error as Error).message}`);
      throw new BadRequestException('The PDF could not be parsed');
    }

    const chunks = chunkPages(parsed.pageTexts);
    if (chunks.length === 0) {
      throw new BadRequestException('The PDF contains no extractable text');
    }

    this.logger.log(`Embedding ${chunks.length} chunks for "${filename}"`);
    const vectors = await this.embeddings.embed(chunks.map((chunk) => chunk.content));

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const documentResult = await client.query<{ id: string; created_at: string }>(
        'INSERT INTO documents (filename, pages) VALUES ($1, $2) RETURNING id, created_at',
        [filename, parsed.pages],
      );
      const documentId = documentResult.rows[0].id;

      for (let i = 0; i < chunks.length; i += 1) {
        await client.query(
          'INSERT INTO chunks (document_id, content, page, embedding) VALUES ($1, $2, $3, $4::vector)',
          [documentId, chunks[i].content, chunks[i].page, toSqlVector(vectors[i])],
        );
      }
      await client.query('COMMIT');

      return {
        id: documentId,
        filename,
        pages: parsed.pages,
        chunks: chunks.length,
        createdAt: documentResult.rows[0].created_at,
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async findAll(): Promise<DocumentRecord[]> {
    const result = await this.pool.query<{
      id: string;
      filename: string;
      pages: number;
      chunks: string;
      created_at: string;
    }>(
      `SELECT d.id, d.filename, d.pages, d.created_at, COUNT(c.id) AS chunks
       FROM documents d
       LEFT JOIN chunks c ON c.document_id = d.id
       GROUP BY d.id
       ORDER BY d.created_at DESC`,
    );
    return result.rows.map((row) => ({
      id: row.id,
      filename: row.filename,
      pages: row.pages,
      chunks: Number(row.chunks),
      createdAt: row.created_at,
    }));
  }

  async remove(id: string): Promise<void> {
    const result = await this.pool.query('DELETE FROM documents WHERE id = $1', [id]);
    if (result.rowCount === 0) {
      throw new NotFoundException(`Document ${id} was not found`);
    }
  }
}
