import {
  SearchItem as BaseSearchItem,
  BaseStore,
  GetOperation,
  Item,
  ListNamespacesOperation,
  MatchCondition,
  Operation,
  OperationResults,
  PutOperation,
  SearchOperation
} from "@langchain/langgraph-checkpoint";

import { Embeddings } from "@langchain/core/embeddings";
import { QdrantClient } from "@qdrant/js-client-rest";
import { QdrantVectorStore } from "@langchain/qdrant";

interface IndexConfig {
  dims?: number;
  fields?: string[];
  __tokenizedFields?: [string, string[]][];
  maxChunkSize?: number;
}

interface QdrantMetadata {
  key?: string;
  namespace?: string;
  chunkIndex?: number;
  totalChunks?: number;
  [key: string]: any;
}

// Define SearchItem type extending the base SearchItem
export interface SearchItem extends BaseSearchItem {
  metadata?: Record<string, any>;
}

export class QdrantMemoryStore extends BaseStore {
  private readonly client: QdrantClient;
  private readonly vectorStore: QdrantVectorStore;
  private readonly _indexConfig?: IndexConfig;
  private readonly collectionName: string;
  private readonly defaultVector: number[];
  private readonly MAX_CHUNK_SIZE: number;

  constructor(
    qdrantUrl: string, 
    embeddings: Embeddings, 
    options?: { 
      port?: number, 
      index?: IndexConfig,
      collectionName?: string 
    }
  ) {
    super();
    
    const {
      index,
      collectionName = "memory"
    } = options || {};

    this.client = new QdrantClient({ 
      url: qdrantUrl
    });

    this._indexConfig = index
      ? {
          ...index,
          dims: index.dims ?? 1536,
          __tokenizedFields: index.fields?.map((field) => [field, field.split(".")])
        }
      : undefined;

    this.collectionName = collectionName;
    this.MAX_CHUNK_SIZE = this._indexConfig?.maxChunkSize ?? 1000;

    this.defaultVector = new Array(this._indexConfig?.dims ?? 1536).fill(0);

    this.vectorStore = new QdrantVectorStore(embeddings, {
      client: this.client,
      collectionName: this.collectionName
    });
  }

  async batch<Op extends Operation[]>(
    operations: Op
  ): Promise<OperationResults<Op>> {
    const results: any[] = [];

    for (const op of operations) {
      if ("key" in op && "namespace" in op) {
        if ("value" in op) {
          // Put operation
          await this.putOperation(op);
          results.push(null);
        } else {
          // Get operation
          const result = await this.getOperation(op);
          results.push(result);
        }
      } else if ("namespacePrefix" in op) {
        // Search operation
        const searchResult = await this.searchOperation(op);
        results.push(searchResult);
      } else if ("matchConditions" in op) {
        // List namespaces operation
        const namespaces = await this.listNamespacesOperation(
          op
        );
        results.push(namespaces);
      }
    }

    return results as OperationResults<Op>;
  }

  // Implement BaseStore methods
  async get(namespace: string[], key: string): Promise<Item | null> {
    const result = await this.batch([{ namespace, key }]);
    return result[0];
  }

  async search(
    namespacePrefix: string[],
    options?: {
      filter?: Record<string, any>;
      limit?: number;
      offset?: number;
      query?: string;
    }
  ): Promise<SearchItem[]> {
    const searchOp: SearchOperation = {
      namespacePrefix,
      ...options
    };
    const result = await this.batch([searchOp]);
    return result[0] as SearchItem[];
  }

  async put(
    namespace: string[],
    key: string,
    value: Record<string, any>,
    index?: false | string[]
  ): Promise<void> {
    const putOp: PutOperation = { namespace, key, value, index };
    await this.batch([putOp]);
  }

  async delete(namespace: string[], key: string): Promise<void> {
    const deleteOp: PutOperation = { namespace, key, value: null };
    await this.batch([deleteOp]);
  }

  async listNamespaces(options?: {
    prefix?: string[];
    suffix?: string[];
    maxDepth?: number;
    limit?: number;
    offset?: number;
  }): Promise<string[][]> {
    const listOp: ListNamespacesOperation = {
      matchConditions: options?.prefix
        ? [{ matchType: "prefix", path: options.prefix }]
        : options?.suffix
        ? [{ matchType: "suffix", path: options.suffix }]
        : undefined,
      limit: options?.limit ?? 10,
      offset: options?.offset ?? 0,
      maxDepth: options?.maxDepth
    };
    const result = await this.batch([listOp]);
    return result[0];
  }

  start(): void {
    // Optional initialization if needed
  }

  stop(): void {
    // Optional cleanup if needed
  }

  private chunkText(text: string, maxChunkSize: number): string[] {
    const chunks: string[] = [];
    
    // If text is shorter than max chunk size, return as-is
    if (text.length <= maxChunkSize) {
      return [text];
    }

    // Split text into chunks, trying to break at word boundaries
    let currentChunk = '';
    const words = text.split(/\s+/);

    for (const word of words) {
      // If adding this word would exceed chunk size, start a new chunk
      if ((currentChunk + ' ' + word).length > maxChunkSize) {
        chunks.push(currentChunk.trim());
        currentChunk = word;
      } else {
        currentChunk += (currentChunk ? ' ' : '') + word;
      }
    }

    // Add the last chunk if not empty
    if (currentChunk.trim()) {
      chunks.push(currentChunk.trim());
    }

    return chunks;
  }

  private async putOperation(op: PutOperation): Promise<void> {
    const key = `${op.namespace.join(":")}:${op.key}`;

    if (op.value === null) {
      // Delete operation
      await this.client.delete(this.collectionName, {
        points: [key]
      });
      return;
    }

    // If index config and embeddings are available, create vector embedding
    if (this.vectorStore.embeddings) {
      const texts = this.extractTexts([op]);
      
      for (const [text, metadataList] of Object.entries(texts)) {
        // Chunk the text
        const chunks = this.chunkText(text, this.MAX_CHUNK_SIZE);
        
        for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
          const chunk = chunks[chunkIndex];
          
          // Embed each chunk
          await this.vectorStore.addDocuments([
            {
              pageContent: chunk,
              metadata: {
                ...op.value,
                key,
                namespace: op.namespace.join(":"),
                field: metadataList[0][2],
                chunkIndex,
                totalChunks: chunks.length
              }
            }
          ]);
        }
      }
    }
  }

  private async getOperation(
    op: GetOperation
  ): Promise<QdrantMetadata | null> {
    const key = `${op.namespace.join(":")}:${op.key}`;

    const results = await this.client.search(this.collectionName, {
      vector: this.defaultVector,
      limit: 1,
      offset: 0,
      filter: {
        must: [{ key: "metadata.key", match: { value: key } }]
      }
    });

    return results.length > 0
      ? (results[0].payload as QdrantMetadata)
      : null;
  }

  private async searchOperation(
    op: SearchOperation
  ): Promise<SearchItem[]> {
    const results = await this.vectorStore.similaritySearchVectorWithScore(
      await this.vectorStore.embeddings.embedQuery(op.query ?? ""),
      op.limit ?? 10,
      {
        should: {
          key: "metadata.namespace",
          match: { value: op.namespacePrefix.join(":") }
        }
      }
    );

    return results.map(([result, score]) => ({
      key: result.metadata.key?.split(":").pop() || '',
      namespace: result.metadata.namespace?.split(":") || [],
      value: result.metadata,
      score: score,
      metadata: result.metadata,
      createdAt: new Date(), // Add a default creation date
      updatedAt: new Date()  // Add a default update date
    }));
  }

  private async listNamespacesOperation(
    op: ListNamespacesOperation
  ): Promise<string[][]> {
    const results = await this.client.search(this.collectionName, {
      vector: this.defaultVector,
      limit: op.limit || 10,
      offset: op.offset || 0
    });

    const namespaces = results
      .map((result) => {
        const metadata = result.payload?.metadata as QdrantMetadata;
        return metadata?.namespace?.split(":") || [];
      })
      .filter((namespace) =>
        !op.matchConditions ||
        op.matchConditions.every((condition: MatchCondition) =>
          this.doesMatch(condition, namespace)
        )
      );

    return namespaces;
  }

  private doesMatch(matchCondition: MatchCondition, key: string[]): boolean {
    const { matchType, path } = matchCondition;

    if (matchType === "prefix") {
      if (path.length > key.length) return false;
      return path.every(
        (pElem: string, index: number) => pElem === "*" || key[index] === pElem
      );
    } else if (matchType === "suffix") {
      if (path.length > key.length) return false;
      return path.every(
        (pElem: string, index: number) =>
          pElem === "*" || key[key.length - path.length + index] === pElem
      );
    }

    throw new Error(`Unsupported match type: ${matchType}`);
  }

  private extractTexts(ops: PutOperation[]): Record<string, [string[], string, string][]> {
    const toEmbed: Record<string, [string[], string, string][]> = {};

    for (const op of ops) {
      if (op.value !== null && op.index !== false) {
        const paths = this._indexConfig?.__tokenizedFields || [["$", ["$"]]];

        for (const [path, field] of paths) {
          const texts = this.getTextAtPath(op.value, field);

          texts.forEach((text, i) => {
            if (!toEmbed[text]) toEmbed[text] = [];
            toEmbed[text].push([op.namespace, op.key, `${path}.${i}`]);
          });
        }
      }
    }

    return toEmbed;
  }

  private getTextAtPath(obj: any, path: string[]): string[] {
    if (path[0] === "$") return [JSON.stringify(obj)];

    let current: any = obj;
    for (const key of path) {
      if (current && typeof current === "object") {
        current = current[key];
      } else {
        return [];
      }
    }

    return current !== undefined ? [String(current)] : [];
  }

  get indexConfig(): IndexConfig | undefined {
    return this._indexConfig;
  }
}
