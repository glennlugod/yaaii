import './App.css';

import {
  Box,
  Button,
  Container,
  Paper,
  TextField,
  ThemeProvider,
  Typography,
  createTheme
} from '@mui/material';
import { OllamaConfig, ServerDependencies } from '../../electron/AIGraph/llmConfig';
import React, { useState } from 'react';

import SendIcon from '@mui/icons-material/Send';

// Define message type
interface Message {
  id: number;
  text: string;
  sender: 'user' | 'ai';
}

// Create a theme
const theme = createTheme({
  palette: {
    primary: {
      main: '#3f51b5',
    },
    background: {
      default: '#f4f4f4',
    },
  },
  typography: {
    fontFamily: 'Roboto, Arial, sans-serif',
  },
});

function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [threadId, setThreadId] = useState<string>('');

  const callGraph = async (inputText: string) => {
    try {
      const userSystemMessage: string = "";

      const servers: ServerDependencies = {
        mongodbUrl: 'mongodb://localhost:27017',
        qdrantUrl: 'http://localhost:6333'
      };

      const llmConfig: OllamaConfig = {
        label: "qwen2.5:7b",
        modelName: "qwen2.5:7b",
        ollamaUrl: "http://localhost:11434",
        provider: "ollama",
        temperature: 0,
      }

      const embeddingConfig: OllamaConfig = {
        label: "nomic-embed-text",
        modelName: "nomic-embed-text",
        ollamaUrl: "http://localhost:11434",
        provider: "ollama",
        temperature: 0,
      }

      const params = {
        threadId: threadId,
        systemMessage: userSystemMessage,
        inputText: inputText,
        llmConfig: llmConfig,
        embeddingConfig: embeddingConfig,
        servers: servers,
      }

      const sendMessageUrl = window.location.port === '1941'
        ? '/api/sendMessage'
        : 'http://localhost:1941/api/sendMessage';

      const response = await fetch(sendMessageUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(params)
      });

      const result = await response.json();

      if (result.success) {
        const aiMessage: Message = {
          id: Date.now(),
          text: result.response ?? '',
          sender: 'ai'
        };
        setMessages(prevMessages => [...prevMessages, aiMessage]);
      } else {
        console.error('Call to AI graph failed:', result.error);
      }

      if (result.threadId) {
        setThreadId(result.threadId);
      }
    } catch (error) {
      console.error('Error processing conversation:', error);
    }
  };

  const handleSendMessage = async () => {
    if (inputText.trim() === '') return;

    // Add user message
    const userMessage: Message = {
      id: Date.now(),
      text: inputText,
      sender: 'user'
    };

    setMessages(prevMessages => [...prevMessages, userMessage]);
    setInputText('');

    await callGraph(inputText);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.ctrlKey && event.key === 'Enter') {
      handleSendMessage();
    }
  };

  return (
    <ThemeProvider theme={theme}>
      <Container maxWidth="sm" sx={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
        <Box 
          sx={{ 
            flexGrow: 1, 
            overflowY: 'auto', 
            padding: 2, 
            marginBottom: 2 
          }}
        >
          {messages.map((message) => (
            <Paper
              key={message.id}
              sx={{
                padding: 2,
                marginBottom: 1,
                alignSelf: message.sender === 'user' ? 'flex-end' : 'flex-start',
                backgroundColor: message.sender === 'user' ? '#e6f2ff' : '#f0f0f0',
                maxWidth: '80%',
                alignItems: message.sender === 'user' ? 'flex-end' : 'flex-start',
                marginLeft: message.sender === 'ai' ? 0 : 'auto',
                marginRight: message.sender === 'user' ? 0 : 'auto',
              }}
            >
              <Typography variant="body1">{message.text}</Typography>
            </Paper>
          ))}
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', padding: 2 }}>
          <TextField
            fullWidth
            variant="outlined"
            placeholder="Type your message..."
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            sx={{ marginRight: 2 }}
            multiline
            maxRows={4}
          />
          <Button
            variant="contained"
            color="primary"
            onClick={handleSendMessage}
            startIcon={<SendIcon />}
          >
            Send
          </Button>
        </Box>
      </Container>
    </ThemeProvider>
  );
}

export default App;
