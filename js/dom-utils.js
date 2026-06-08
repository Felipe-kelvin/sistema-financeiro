export function createElement(tag, options = {}) {
  const element = document.createElement(tag);

  if (options.className) {
    element.className = options.className;
  }

  if (options.text !== undefined && options.text !== null) {
    element.textContent = options.text;
  }

  if (options.attrs) {
    Object.entries(options.attrs).forEach(([name, value]) => {
      element.setAttribute(name, value);
    });
  }

  if (options.dataset) {
    Object.assign(element.dataset, options.dataset);
  }

  if (options.events) {
    Object.entries(options.events).forEach(([eventName, listener]) => {
      element.addEventListener(eventName, listener);
    });
  }

  if (options.children) {
    options.children.forEach((child) => {
      if (child instanceof Node) {
        element.appendChild(child);
      } else if (child !== undefined && child !== null) {
        element.appendChild(document.createTextNode(String(child)));
      }
    });
  }

  return element;
}

export function clearElement(element) {
  while (element.firstChild) {
    element.removeChild(element.firstChild);
  }
}
