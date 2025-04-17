import { LLMConfig, OllamaConfig, OpenAIConfig } from "./llmConfig";

import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { ChatOllama } from "@langchain/ollama";
import { ChatOpenAI } from "@langchain/openai";

export const getLLM = (llmConfig: LLMConfig): BaseChatModel => {
  const temperature = llmConfig.temperature ?? 0.1;

  if (llmConfig.provider.toLowerCase() === 'ollama') {
    const config = llmConfig as OllamaConfig;
    return new ChatOllama({ 
      temperature,
      model: config.modelName,
      baseUrl: config.ollamaUrl
    });
  }

  if (llmConfig.provider.toLowerCase() === 'openai') {
    const config = llmConfig as OpenAIConfig;
    return new ChatOpenAI({
      temperature,
      model: config.modelName,
      apiKey: config.openaiApiKey
    });
  }

  throw new Error(`Unknown provider: ${llmConfig.provider}`);
};
