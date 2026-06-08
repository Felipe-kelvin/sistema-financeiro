const FEEDBACK_CONTAINER_ID = "feedback-container";
const FEEDBACK_TIMEOUT = 5000;

function getFeedbackContainer() {
  let container = document.getElementById(FEEDBACK_CONTAINER_ID);
  if (!container) {
    container = document.createElement("div");
    container.id = FEEDBACK_CONTAINER_ID;
    container.className = "message-container";
    document.body.prepend(container);
  }
  return container;
}

function createMessageElement(type, text) {
  const message = document.createElement("div");
  message.className = `message-item message-${type}`;

  const icon = document.createElement("span");
  icon.className = "message-icon";
  icon.textContent = type === "success" ? "✓" : type === "error" ? "⚠" : "ℹ";

  const content = document.createElement("span");
  content.className = "message-text";
  content.textContent = text;

  message.append(icon, content);
  return message;
}

export function showMessage(type, text, duration = FEEDBACK_TIMEOUT) {
  const container = getFeedbackContainer();
  const message = createMessageElement(type, text);
  container.appendChild(message);

  if (duration > 0) {
    window.setTimeout(() => {
      message.remove();
    }, duration);
  }

  return message;
}

export function showSuccess(text, duration) {
  return showMessage("success", text, duration);
}

export function showError(text, duration) {
  return showMessage("error", text, duration);
}

export function showInfo(text, duration) {
  return showMessage("info", text, duration);
}

export function clearFeedback() {
  const container = getFeedbackContainer();
  container.textContent = "";
}
