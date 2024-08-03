const mongoose = require('mongoose');

const chatSchema = new mongoose.Schema({
  sessionId: String, // Changed from userId to sessionId
  userMessage: String,
  botResponse: String,
  timestamp: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Chat', chatSchema);
