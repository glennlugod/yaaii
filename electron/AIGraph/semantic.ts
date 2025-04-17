import { AIMessage, BaseMessage, HumanMessage } from "@langchain/core/messages";
import { BaseCheckpointSaver, BaseStore, Checkpoint, CheckpointTuple } from "@langchain/langgraph-checkpoint";

import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { PromptTemplate } from "@langchain/core/prompts";
import { v4 as uuidv4 } from 'uuid';

export const checkMessageRelatedness = async (
  message: string,
  threadMessages: BaseMessage[],
  llm: BaseChatModel,
): Promise<{ related: 'related' | 'not' }> => {
  // Extract message contents from thread history
  const historicalMessages = threadMessages
    .filter(msg => msg instanceof AIMessage || msg instanceof HumanMessage)
    .map(msg => {
      // Try multiple ways to extract content
      const content = msg.content || '';
      if (!content) {
        return '';
      }
      if (typeof content !== 'string') {
        return '';
      }

      if (msg instanceof HumanMessage) {
        return "Human: " + content;
      } else {
        return "AI: " + content;
      }
    })
    .filter(Boolean);

  // Create a prompt template for relatedness check
  const promptTemplate = new PromptTemplate({
    template: `
You are an expert at determining message relatedness. 
Given a new message and a list of historical messages, determine if the new message is related to the conversation.

New Message: {new_message}
Historical Messages: {historical_messages}

Respond ONLY with JSON in this format:
{{ "related": "related" if the messages are about the same topic, otherwise "not" }}
    `,
    inputVariables: ["new_message", "historical_messages"]
  });

  // Prepare the input
  const input = await promptTemplate.format({
    new_message: message,
    historical_messages: historicalMessages.join('\n---\n')
  });

  // Get LLM response
  const llmResponse = await llm.invoke(input);
  
  try {
    // Safely parse the JSON response
    const responseText = llmResponse.content.toString()
      .replace(/^```?json\b/, '')
      .replace(/\s*```$/, '')
      .trim();
    const result = JSON.parse(responseText);
    
    // Validate the response
    if (result.related === 'related' || result.related === 'not') {
      return result;
    }
    
    // Fallback if parsing fails
    return { related: 'not' };
  } catch (error) {
    console.error('Error parsing relatedness response:', error);
    return { related: 'not' };
  }  
}

export const extractNotes = async (
  messages: BaseMessage[],
  llm: BaseChatModel,
): Promise<string> => {
  // Convert messages to a readable conversation format
  const conversationText = messages
    .filter(msg => msg instanceof AIMessage || msg instanceof HumanMessage)
    .map(msg => {
      const content = msg.content || '';
      if (typeof content !== 'string') {
        return '';
      }
      return msg instanceof HumanMessage 
        ? `Human: ${content}` 
        : `AI: ${content}`;
    })
    .filter(Boolean)
    .join('\n---\n');

  // Create a prompt template for note extraction
  const notesPromptTemplate = new PromptTemplate({
    template: `
You are an expert note-taker tasked with extracting key insights from a conversation. 
Analyze the following conversation and generate comprehensive, markdown-formatted notes.

Conversation:
{conversation}

Guidelines for note generation:
1. Create bulleted notes that capture the main points and insights
2. Expand on each point with additional context or explanation
3. Focus on the most significant and memorable aspects of the conversation
4. Organize notes in a clear, logical manner
5. Use markdown formatting for readability

Notes:
`,
    inputVariables: ["conversation"]
  });

  // Prepare the input for note generation
  const notesInput = await notesPromptTemplate.format({
    conversation: conversationText
  });

  // Generate notes using the LLM
  const notesResponse = await llm.invoke(notesInput);
  
  // Extract and clean the notes
  const notes = notesResponse.content.toString()
    .replace(/^```?markdown\b/, '')
    .replace(/\s*```$/, '')
    .trim();

  // Ensure markdown formatting
  return notes.startsWith('# ') || notes.startsWith('- ') 
    ? notes 
    : `# Conversation Notes\n\n${notes}`;
}

const saveToLongTermMemory = async (
  messages: BaseMessage[],
  llm: BaseChatModel,
  store: BaseStore
): Promise<void> => {
  const notes = await extractNotes(messages, llm);
  await store.put(
    ["memories"],
    uuidv4(),
    { "text": notes }
  )
}

export const checkAndStore = async (
  threadId: string, 
  message: string, 
  llm: BaseChatModel,
  checkpointer: BaseCheckpointSaver,
  store: BaseStore
): Promise<{ related: 'related' | 'not' }> => {
  try {
    // Retrieve messages for the given threadId
    const threadMessagesGenerator = checkpointer.list({ 
      configurable: { thread_id: threadId } 
    });

    // just get the first message
    const latestCheckpointTupleIR = await threadMessagesGenerator.next();
    if (!latestCheckpointTupleIR) {
      return { related: 'not' };
    }

    const latestCheckpointTuple: CheckpointTuple = latestCheckpointTupleIR.value;
    if (!latestCheckpointTuple) {
      return { related: 'not' };
    }

    const checkpoint: Checkpoint = latestCheckpointTuple.checkpoint;

    const messages = checkpoint.channel_values.messages as BaseMessage[];

    const relatednessResult = await checkMessageRelatedness(message, messages, llm);
    if (relatednessResult.related === 'not') {
      // save messages to long-term memory
      await saveToLongTermMemory(messages, llm, store);
    }

    return relatednessResult;
  } catch (error) {
    console.error('Error in checkAndStore:', error);
    return { related: 'not' };
  }
}
