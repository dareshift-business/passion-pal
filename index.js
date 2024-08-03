const express = require('express');
const axios = require('axios');
const path = require('path');
require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');
const mongoose = require('mongoose');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const badWords = require('bad-words');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const fs = require('fs');
const filter = new badWords();
const Chat = require('./models/Chat'); // Import the Chat model
const Project = require('./models/Project.js');

const app = express();
const port = process.env.PORT || 3000;
const csvFilePath = 'conversations.csv';
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
});

if (!fs.existsSync(csvFilePath)) {
  const header = [
    { id: 'userId', title: 'User ID' },
    { id: 'userMessage', title: 'User Message' },
    { id: 'botResponse', title: 'Bot Response' },
    { id: 'timestamp', title: 'Timestamp' }
  ];

  createCsvWriter({
    path: csvFilePath,
    header: header
  }).writeRecords([]).then(() => console.log('CSV file created with headers.'));
}

// Middleware
app.use(cors()); // Enable CORS
app.use(limiter);
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB connection error:', err));

// Initialize Google Generative AI
const genAI = new GoogleGenerativeAI(process.env.API_KEY);

function appendToCSV(userId, userMessage, botResponse) {
  const csvWriter = createCsvWriter({
    path: csvFilePath,
    append: true,
    header: [
      { id: 'userId', title: 'User ID' },
      { id: 'userMessage', title: 'User Message' },
      { id: 'botResponse', title: 'Bot Response' },
      { id: 'timestamp', title: 'Timestamp' }
    ]
  });

  const record = [{
    userId: userId,
    userMessage: userMessage,
    botResponse: botResponse,
    timestamp: new Date().toISOString()
  }];

  csvWriter.writeRecords(record)
    .then(() => console.log('Conversation appended to CSV.'));
}

async function generateContent(sessionId, prompt) {
  try {
    const basePrompt = "You are a helpful and knowledgeable chatbot designed to assist first-generation, low-income (FGLI) students in brainstorming, planning, and executing passion projects. Your goal is to provide personalized guidance, resources, and actionable steps to help students turn their ideas into successful projects."; 
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const chatHistory = await Chat.find({ sessionId });
    const history = chatHistory.map(chat => `User: ${chat.userMessage}\nBot: ${chat.botResponse}`).join('\n');
    const fullPrompt = history ? `${history}\nUser: ${prompt}` : `User: ${prompt}`;
    const result = await model.generateContent(basePrompt + fullPrompt);
    const response = result.response;
    
    // Save chat history to MongoDB
    const newChat = new Chat({
      sessionId: sessionId,
      userMessage: prompt,
      botResponse: response.text()
    });
    await newChat.save();
    
    return response.text();
  } catch (error) {
    console.error('Error generating content:', error);
    throw error;
  }
}

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.post('/chat', async (req, res) => {
  const sessionId = req.body.sessionId || 'default';
  const userMessage = req.body.message;
  
  if (filter.isProfane(userMessage)) {
    return res.status(400).json({ error: 'Inappropriate content detected.' });
  }

  try {
    const botReply = await generateContent(sessionId, userMessage);
    console.log(`Bot reply: ${botReply}`);
    res.json({ reply: botReply });
    appendToCSV(sessionId, userMessage, botReply);
  } catch (error) {
    console.error(error);
    res.status(500).send('Error communicating with Gemini API');
  }
});

// Endpoint to load chat history
app.get('/load-chats/:sessionId', async (req, res) => {
  const sessionId = req.params.sessionId;
  
  try {
    const chatHistory = await Chat.find({ sessionId });
    if (chatHistory.length > 0) {
      res.status(200).json(chatHistory);
    } else {
      res.status(404).json({ message: 'No chat history found for this session.' });
    }
  } catch (error) {
    console.error('Error loading chat history:', error);
    res.status(500).json({ message: 'Error loading chat history' });
  }
});

// Endpoint to get all projects
app.get('/projects', async (req, res) => {
  try {
    const projects = await Project.find({});
    res.status(200).json(projects);
  } catch (error) {
    console.error('Error fetching projects:', error);
    res.status(500).json({ message: 'Failed to fetch projects' });
  }
});

// Endpoint to create a new project
app.post('/projects', async (req, res) => {
  const { name, sessionId } = req.body;
  try {
    const newProject = new Project({ name, sessionId });
    await newProject.save();
    res.status(201).json(newProject);
  } catch (error) {
    console.error('Error creating project:', error);
    res.status(500).json({ message: 'Failed to create project' });
  }
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
