# YAAII (Yet Another AI Interface)

## Overview

YAAII is a desktop AI application designed to provide a comprehensive, locally-run AI interface. The core philosophy of this project is to enable powerful AI interactions entirely on the user's local machine, ensuring privacy, performance, and full control.

## Project Video

Check out the detailed walkthrough of how this application was built in our YouTube video:
[How to Build a Local AI Desktop Application](https://youtu.be/8K5pxVfcMlk)

## Key Features

- 🖥️ Desktop Application: Built with Electron for cross-platform compatibility
- 🔒 Local-First Approach: All AI processing and data storage happens locally
- 🧠 Advanced AI Capabilities: Leveraging cutting-edge AI technologies
- 🔍 Semantic Memory: Intelligent context and memory management
- 🛠️ Extensible Architecture: Modular design for easy feature expansion

## Project Structure

- `electron/`: Electron application core
  - `main.ts`: Main application entry point
  - `AIGraph/`: AI-related modules
    - `conversationGraph.ts`: Conversation management
    - `llmFactory.ts`: Language model configuration
    - `QdrantMemoryStore.ts`: Semantic memory storage
- `frontend/`: React-based user interface
  - `src/`: Frontend source code
  - `App.tsx`: Main application component

## Getting Started

### Prerequisites

- Node.js (version 16+ recommended)
- npm

### Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   cd frontend
   npm install
   ```

3. Run the application:
   ```bash
   npm run start
   ```

## Development

- `cd frontend && npm run build`: Start frontend development server
- Initiate a debug using "Main + Renderer" configuration

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT License

Copyright (c) 2025 YAAII Project

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

## Contact

For more information, please open an issue in the GitHub repository.
