import { AIMessageChunk, BaseMessage, SystemMessage } from "@langchain/core/messages";
import {
  Annotation,
  BaseCheckpointSaver,
  BaseStore,
  CompiledStateGraph,
  END,
  START,
  StateDefinition,
  StateGraph
} from "@langchain/langgraph";
import { RunnableConfig, RunnableFunc, RunnableToolLike } from "@langchain/core/runnables";

import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { QdrantMemoryStore } from "./QdrantMemoryStore.js";
import { StructuredToolInterface } from '@langchain/core/tools';
import { ToolNode } from '@langchain/langgraph/prebuilt';

const GraphState = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    reducer: (x, y) => x.concat(y),
  }),
});

export type ConversationState = typeof GraphState.State;

// Define the return type for createConversationGraph
export type ConversationGraph = CompiledStateGraph<ConversationState, Partial<ConversationState>, typeof START, StateDefinition, StateDefinition>;

interface RunnableConfigWithStore extends RunnableConfig {
  store: BaseStore;
};

// Create a conversation graph utility function
export function createConversationGraph(
  model: BaseChatModel,
  tools: (StructuredToolInterface | RunnableToolLike)[],
  checkpointer: BaseCheckpointSaver,
  store: BaseStore
): ConversationGraph {
  if (!model.bindTools) {
    throw new Error("Model does not support binding tools");
  }

  const boundModel = model.bindTools(tools);

  const toolNode = new ToolNode(tools);

  const recallMemory = async (messages: BaseMessage[], store: BaseStore): Promise<BaseMessage[]> => {
    const query = messages[messages.length - 1].content;
    if (typeof query === "string") {
      const memories = await store.search(
        ["memories"],
        {
          query,
          limit: 5
        }
      );
      if (memories.length > 0) {
        const info = memories.map((d) => d.value.text).join("\n");
        const message = `Memory recalled: \n${info}`;
        return [ new SystemMessage(message) ];
      }
    }
    return [];
  }

  const callModel = async (
    state: ConversationState,
    config?: RunnableConfig,
  ) => {
    const store = (config as RunnableConfigWithStore)?.store as QdrantMemoryStore;
    if (!store) {
      throw new Error("No store provided to state modifier.");
    }

    const { messages } = state;

    const memoryMessages = await recallMemory(messages, store);
    const messagesWithMemory =  [...memoryMessages, ...messages ];

    const systemMessage = config?.configurable?.systemMessage ? new SystemMessage(config.configurable.systemMessage) : undefined;
    const msgs: BaseMessage[] = systemMessage ? [systemMessage, ...messagesWithMemory] : messagesWithMemory;
    const response: AIMessageChunk = await boundModel.invoke(msgs, config);
    return { messages: [ response ] };
  };

  const shouldContinue: RunnableFunc<ConversationState, typeof END | "tools"> = (
    state: ConversationState
  ) => {
    const { messages } = state;
    const lastMessage = messages[messages.length - 1];
    if ("tool_calls" in lastMessage && Array.isArray(lastMessage.tool_calls) && lastMessage.tool_calls?.length) {
        return "tools";
    }
    return END;
  };

  // Define the graph structure
  const graph = new StateGraph(GraphState);
  graph.addNode("agent", callModel)
    .addNode("tools", toolNode)
    .addEdge(START, "agent")
    .addConditionalEdges("agent", shouldContinue, ["tools", END])
    .addEdge("agent", END);

  // Compile and return methods
  const compiledGraph = graph.compile({
    checkpointer: checkpointer,
    store: store
  });
  
  return compiledGraph;
}
