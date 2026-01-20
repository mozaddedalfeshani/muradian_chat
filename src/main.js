let messageInput;
let chatMessages;
let sendBtn;
let conversationHistory = [];

async function sendMessage() {
  const message = messageInput.value.trim();
  if (!message) return;

  // Add user message to chat
  addMessage(message, "user");
  messageInput.value = "";
  sendBtn.disabled = true;

  try {
    // Call Ollama API
    const response = await fetch("http://localhost:11434/api/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "deepseek-r1:1.5b",
        prompt: message,
        stream: false,
      }),
    });

    if (!response.ok) {
      throw new Error("Failed to get response from Ollama");
    }

    const data = await response.json();
    const assistantMessage = data.response;

    // Add assistant message to chat
    addMessage(assistantMessage, "assistant");
  } catch (error) {
    console.error("Error:", error);
    addMessage(
      "Error: Could not connect to Ollama. Make sure Ollama is running.",
      "error",
    );
  } finally {
    sendBtn.disabled = false;
    messageInput.focus();
  }
}

function addMessage(content, type) {
  const messageDiv = document.createElement("div");
  messageDiv.className = `message ${type}`;

  const contentDiv = document.createElement("div");
  contentDiv.className = "message-content";
  contentDiv.textContent = content;

  messageDiv.appendChild(contentDiv);
  chatMessages.appendChild(messageDiv);

  // Scroll to bottom
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

window.addEventListener("DOMContentLoaded", () => {
  messageInput = document.querySelector("#message-input");
  chatMessages = document.querySelector("#chat-messages");
  sendBtn = document.querySelector("#send-btn");

  document.querySelector("#chat-form").addEventListener("submit", (e) => {
    e.preventDefault();
    sendMessage();
  });

  // Focus on input
  messageInput.focus();
});
