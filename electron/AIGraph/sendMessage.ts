import { AIMessage, HumanMessage } from "@langchain/core/messages";
import { ConversationState, createConversationGraph } from "./conversationGraph.js";
import { LLMConfig, ServerDependencies } from "./llmConfig.js";
import { MongoClient, MongoServerSelectionError } from "mongodb";

import { MongoDBSaver } from "@langchain/langgraph-checkpoint-mongodb";
import { QdrantMemoryStore } from "./QdrantMemoryStore.js";
import { RunnableConfig } from "@langchain/core/runnables";
import { checkAndStore } from "./semantic.js";
import { getEmbedding } from "./embeddingsFactory.js";
import { getLLM } from "./llmFactory.js";
import { tools } from "./tools.js";
import { v4 as uuidv4 } from 'uuid';

export interface CallGraphParams {
  threadId: string;
  systemMessage: string;
  inputText: string;
  llmConfig: LLMConfig;
  embeddingConfig: LLMConfig;
  servers: ServerDependencies;
}

export interface CallGraphResult {
  success: boolean;
  threadId?: string;
  response?: AIMessage;
  error?: string;
}

export const callGraph = async (params: CallGraphParams): Promise<CallGraphResult> => {
  const {threadId, systemMessage, inputText, llmConfig, embeddingConfig, servers} = params;

  let client: MongoClient | null = null;

  try {
    // Establish MongoDB connection
    client = new MongoClient(servers.mongodbUrl);
    await client.connect();

    const checkpointer = new MongoDBSaver({ client });

    const embeddings = getEmbedding(embeddingConfig);

    const store = new QdrantMemoryStore(
      servers.qdrantUrl,
      embeddings,
      {
        index: {
          dims: 1536,
        }
      }
    )

    const model = getLLM(llmConfig);

    let tid: string;
    if (threadId) {
      const relatednessResult = await checkAndStore(
        threadId, 
        inputText, 
        model, 
        checkpointer, 
        store
      );
      tid = relatednessResult.related === 'related' ? threadId : uuidv4();
    } else {
      tid = uuidv4();
    }

    const conversationState: ConversationState = {
      messages: [ 
        new HumanMessage(inputText) 
      ],
    };

    const config: RunnableConfig = {
      configurable: {
        systemMessage: systemMessage,
        thread_id: tid
      }
    };
    
    // Invoke the conversation graph
    const graph = createConversationGraph(model, tools, checkpointer, store);
    const result = await graph.invoke(conversationState, {
      ...config
    });
    
    console.log('Conversation graph result:', result);

    const reply: AIMessage = result.messages[result.messages.length - 1] as AIMessage;
    console.log('AI reply:', reply.content);

    return {
      success: true,
      threadId: tid,
      response: reply
    };
  } catch (error) {
    console.error('Error processing conversation:', error);
    if (error instanceof MongoServerSelectionError) {
      return {
        success: false,
        threadId: threadId,
        error: error.message
      }
    }
    
    return {
      success: false,
      threadId: threadId,
      error: error as string
    }
  } finally {
    // Ensure MongoDB client is closed
    if (client) {
      await client.close();
    }
  }
};
