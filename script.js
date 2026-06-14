const bookingForm = document.querySelector("#bookingForm");
const formMessage = document.querySelector("#formMessage");

bookingForm.addEventListener("submit", (event) => {
  event.preventDefault();

  const formData = new FormData(bookingForm);
  const name = String(formData.get("name") || "").trim();
  const style = String(formData.get("style") || "").trim();

  formMessage.textContent = `Thanks${name ? `, ${name}` : ""}. Your ${style || "tattoo"} request is ready to send.`;
  bookingForm.reset();
});
