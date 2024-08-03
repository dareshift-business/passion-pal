// models/Project.js
const mongoose = require('mongoose');

const projectSchema = new mongoose.Schema({
  name: String,
  sessionId: String,
});

module.exports = mongoose.model('Project', projectSchema);
