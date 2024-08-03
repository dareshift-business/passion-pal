// Generate a unique session ID for each user session
let currentSessionId = generateSessionId();

document.getElementById("add-project-button").addEventListener('click', createProject);

// Function to generate a unique session ID
function generateSessionId() {
  return 'session-' + Math.random().toString(36).substr(2, 9);
}

// Load projects from the server and display them
async function loadProjects() {
  try {
    const response = await fetch('http://localhost:3000/projects');
    const projects = await response.json();
    const projectButtons = document.getElementById('project-buttons');
    
    // Clear existing buttons
    projectButtons.innerHTML = '';

    projects.forEach(project => {
      const button = document.createElement('button');
      button.textContent = project.name;
      button.classList.add('btn');
      button.classList.add('btn-light');
      button.onclick = () => loadProject(project.sessionId);
      projectButtons.appendChild(button);
    });

    // Add button to create a new project
    const newProjectButton = document.createElement('button');
    newProjectButton.textContent = 'Create New Project';
    newProjectButton.classList.add('btn');
    newProjectButton.classList.add('btn-primary');
    newProjectButton.onclick = createProject;
    projectButtons.appendChild(newProjectButton);

  } catch (error) {
    console.error('Error fetching projects:', error);
  }
}

// Load chat history for a specific project
async function loadProject(sessionId) {
  currentSessionId = sessionId;
  const response = await fetch(`http://localhost:3000/load-chats/${sessionId}`);
  
  if (!response.ok) {
    console.error('Error fetching chat history:', response.statusText);
    return;
  }

  const history = await response.json();
  const chatWindow = document.getElementById('chat-window');
  chatWindow.innerHTML = ''; // Clear current chat window

  history.forEach(chat => {
    addMessageToChat('user', chat.userMessage);
    addMessageToChat('bot', chat.botResponse);
  });
}

// Save chat history to local storage
function saveChatHistory(history) {
  localStorage.setItem(currentSessionId, JSON.stringify(history));
}

// Event listener for the chat form submission
document.getElementById('chat-form').addEventListener('submit', async (e) => {
  e.preventDefault();

  const messageInput = document.getElementById('message-input');
  const message = messageInput.value.trim();
  if (!message) return;

  addMessageToChat('user', message);

  const history = JSON.parse(localStorage.getItem(currentSessionId)) || [];
  history.push({ sender: 'user', text: message });

  try {
    const response = await fetch('http://localhost:3000/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: currentSessionId, message }),
    });

    if (!response.ok) {
      console.error('Error communicating with chatbot:', response.statusText);
      addMessageToChat('bot', 'Sorry, there was an error.');
      return;
    }

    const data = await response.json();
    addMessageToChat('bot', data.reply);
    history.push({ sender: 'bot', text: data.reply });
    saveChatHistory(history);
  } catch (error) {
    console.error('Error communicating with chatbot:', error);
    addMessageToChat('bot', 'Sorry, there was an error.');
  }

  messageInput.value = '';
});

// Function to add messages to the chat window
function addMessageToChat(sender, text) {
  const chatWindow = document.getElementById('chat-window');
  const messageElement = document.createElement('div');
  messageElement.className = `chat-message ${sender}`;
  messageElement.innerText = text;
  chatWindow.appendChild(messageElement);
  chatWindow.scrollTop = chatWindow.scrollHeight;
}

// Function to create a new project
async function createProject() {
  // Prompt user for project name
  const projectName = prompt('Enter a name for the new project:');
  
  // Use a default name if none provided
  const name = projectName.trim() || `Project-${generateSessionId()}`;
  const sessionId = generateSessionId();

  // Prepare data to send
  const projectData = { name, sessionId };

  try {
    // Send a POST request to create a new project
    const response = await fetch('http://localhost:3000/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(projectData),
    });

    if (response.ok) {
      console.log('Project created successfully.');
      loadProjects(); // Refresh the list of projects
    } else {
      console.error('Error creating project:', response.statusText);
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

// Load projects when the page loads
window.onload = loadProjects;
