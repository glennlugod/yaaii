export interface LLMConfig {
  label: string;
  provider: string;
  modelName: string;
  temperature: number;
}

export interface OpenAIConfig extends LLMConfig {
  openaiApiKey: string;
}

export interface OllamaConfig extends LLMConfig {
  ollamaUrl: string;
}

export interface BedrockConfig extends LLMConfig {
  accessKeyId: string;
  secretAccessKey: string;
}

export interface ServerDependencies {
  mongodbUrl: string;
  qdrantUrl: string;
}
