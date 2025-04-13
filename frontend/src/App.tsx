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

  const handleSendMessage = () => {
    if (inputText.trim() === '') return;

    // Add user message
    const userMessage: Message = {
      id: Date.now(),
      text: inputText,
      sender: 'user'
    };

    // Add AI response (placeholder for actual AI interaction)
    const aiMessage: Message = {
      id: Date.now() + 1,
      text: `AI response to: ${inputText}`,
      sender: 'ai'
    };

    setMessages(prevMessages => [...prevMessages, userMessage, aiMessage]);
    setInputText('');
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
