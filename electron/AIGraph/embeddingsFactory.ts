import { LLMConfig, OllamaConfig } from "./llmConfig";

import { Embeddings } from "@langchain/core/embeddings";
import { OllamaEmbeddings } from "@langchain/ollama";

export const getEmbedding = (llmConfig: LLMConfig): Embeddings => {
  if (llmConfig.provider.toLowerCase() === 'ollama') {
    const config = llmConfig as OllamaConfig;
    return new OllamaEmbeddings({
      model: config.modelName,
      baseUrl: config.ollamaUrl
    });
  }

  throw new Error(`Unknown provider: ${llmConfig.provider}`);
};
