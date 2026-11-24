const form = document.querySelector("#contact-form");
const messageField = document.querySelector("#message");
const messageCounter = document.querySelector("#message-counter");
const submitButton = document.querySelector("#submit-button");
const buttonText = submitButton.querySelector(".button-text");
const buttonLoader = submitButton.querySelector(".button-loader");
const statusBox = document.querySelector("#form-status");

function showStatus(message, type) {
  statusBox.textContent = message;
  statusBox.className = `form-status is-visible is-${type}`;
}

function setLoading(isLoading) {
  submitButton.disabled = isLoading;
  buttonText.hidden = isLoading;
  buttonLoader.hidden = !isLoading;
}

messageField.addEventListener("input", () => {
  messageCounter.textContent = `${messageField.value.length} / 1500`;
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  statusBox.className = "form-status";
  statusBox.textContent = "";

  if (!form.checkValidity()) {
    form.reportValidity();
    showStatus("Проверьте обязательные поля и формат введённых данных.", "error");
    return;
  }

  const formData = new FormData(form);
  const payload = {
    name: formData.get("name"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    message: formData.get("message"),
    website: formData.get("website"),
    consent: formData.get("consent") === "on"
  };

  setLoading(true);

  try {
    const response = await fetch("/api/contact", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(result.error || "Сервис временно недоступен.");
    }

    form.reset();
    messageCounter.textContent = "0 / 1500";
    showStatus(result.message || "Сообщение успешно отправлено.", "success");
  } catch (error) {
    showStatus(error.message || "Не удалось отправить сообщение.", "error");
  } finally {
    setLoading(false);
  }
});
