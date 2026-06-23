const bookingForm = document.querySelector("#bookingForm");
const formMessage = document.querySelector("#formMessage");
const allowedReferenceTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const allowedReferenceExtensions = new Set(["jpg", "jpeg", "png", "webp", "gif"]);
const blockedReferenceExtensions = new Set([
  "app",
  "bat",
  "cmd",
  "com",
  "dll",
  "dmg",
  "exe",
  "html",
  "hta",
  "jar",
  "js",
  "msi",
  "php",
  "ps1",
  "scr",
  "sh",
  "svg",
  "vbs"
]);
const maxReferenceFileSize = 8 * 1024 * 1024;
const submissionCooldownMs = 15000;
let lastBookingSubmissionAt = 0;
const galleryItems = [...document.querySelectorAll(".photo-slot")].map((slot) => {
  const image = slot.querySelector("img");
  const caption = slot.querySelector("figcaption");

  return {
    alt: image?.alt || "",
    caption: caption?.textContent?.trim() || image?.alt || "",
    src: image?.getAttribute("src") || ""
  };
});
const galleryTriggers = [...document.querySelectorAll(".gallery-trigger")];
const lightbox = document.querySelector("#galleryLightbox");
const lightboxImage = document.querySelector(".lightbox-image");
const lightboxCaption = document.querySelector(".lightbox-caption");
const lightboxClose = document.querySelector(".lightbox-close");
const lightboxPrev = document.querySelector(".lightbox-prev");
const lightboxNext = document.querySelector(".lightbox-next");
let activeGalleryIndex = 0;
let lastFocusedGalleryTrigger = null;

const showGalleryImage = (index) => {
  activeGalleryIndex = (index + galleryItems.length) % galleryItems.length;
  const item = galleryItems[activeGalleryIndex];

  lightboxImage.src = item.src;
  lightboxImage.alt = item.alt;
  lightboxCaption.textContent = item.caption;
};

const openLightbox = (index) => {
  lastFocusedGalleryTrigger = document.activeElement;
  showGalleryImage(index);
  lightbox.hidden = false;
  document.body.classList.add("lightbox-open");
  lightboxClose.focus();
};

const closeLightbox = () => {
  lightbox.hidden = true;
  document.body.classList.remove("lightbox-open");
  lightboxImage.src = "";

  if (lastFocusedGalleryTrigger) {
    lastFocusedGalleryTrigger.focus();
  }
};

galleryTriggers.forEach((trigger, index) => {
  trigger.addEventListener("click", () => openLightbox(index));
});

lightboxClose.addEventListener("click", closeLightbox);
lightboxPrev.addEventListener("click", () => showGalleryImage(activeGalleryIndex - 1));
lightboxNext.addEventListener("click", () => showGalleryImage(activeGalleryIndex + 1));

lightbox.addEventListener("click", (event) => {
  if (event.target === lightbox) {
    closeLightbox();
  }
});

document.addEventListener("keydown", (event) => {
  if (lightbox.hidden) {
    return;
  }

  if (event.key === "Escape") {
    closeLightbox();
  }

  if (event.key === "ArrowLeft") {
    showGalleryImage(activeGalleryIndex - 1);
  }

  if (event.key === "ArrowRight") {
    showGalleryImage(activeGalleryIndex + 1);
  }
});

const sanitizeText = (value) => String(value || "")
  .replace(/[\u0000-\u001f\u007f]/g, " ")
  .replace(/[<>{}`]/g, "")
  .replace(/\s+/g, " ")
  .trim();

const containsUnsafeMarkup = (value) => /<\s*\/?\s*script|javascript\s*:|data\s*:\s*text\/html|on[a-z]+\s*=/i.test(String(value || ""));

const getExtension = (fileName) => {
  const parts = String(fileName || "").toLowerCase().split(".");
  return parts.length > 1 ? parts.pop() : "";
};

const validateReferences = (files) => {
  const invalidMessages = [];

  [...files].forEach((file) => {
    const extension = getExtension(file.name);
    const hasAllowedType = allowedReferenceTypes.has(file.type);
    const hasAllowedExtension = allowedReferenceExtensions.has(extension);
    const hasBlockedExtension = blockedReferenceExtensions.has(extension);

    if (hasBlockedExtension || !hasAllowedExtension || (file.type && !hasAllowedType)) {
      invalidMessages.push(`${sanitizeText(file.name)} is not an allowed image file. Use JPG, PNG, WebP, or GIF.`);
    }

    if (file.size > maxReferenceFileSize) {
      invalidMessages.push(`${sanitizeText(file.name)} is larger than 8 MB.`);
    }
  });

  return invalidMessages;
};

const setFormMessage = (message) => {
  if (formMessage) {
    formMessage.textContent = message;
  }
};

const applySanitizedValuesToForm = (values) => {
  Object.entries(values).forEach(([name, value]) => {
    const field = bookingForm.querySelector(`[name="${name}"]`);
    if (field && "value" in field) {
      field.value = value;
    }
  });
};

if (bookingForm) {
  const referenceInput = bookingForm.querySelector('input[name="reference_upload"]');
  const submitButton = bookingForm.querySelector('button[type="submit"]');

  referenceInput?.addEventListener("change", () => {
    const errors = validateReferences(referenceInput.files);
    referenceInput.setCustomValidity(errors.length ? errors[0] : "");
    setFormMessage(errors.join(" ") || "");
  });

  bookingForm.addEventListener("submit", (event) => {
    event.preventDefault();

    const now = Date.now();
    if (now - lastBookingSubmissionAt < submissionCooldownMs) {
      setFormMessage("Please wait a few seconds before sending another booking request.");
      return;
    }

    const formData = new FormData(bookingForm);
    const honeypot = String(formData.get("_gotcha") || "").trim();
    if (honeypot) {
      setFormMessage("Your booking request could not be sent.");
      return;
    }

    const textFields = ["name", "email", "mobile", "tattoo_style", "placement", "preferred_date", "budget", "concept_notes"];
    const unsafeField = textFields.find((field) => containsUnsafeMarkup(formData.get(field)));
    if (unsafeField) {
      setFormMessage("Please remove code-like text from the booking form before sending.");
      return;
    }

    const referenceErrors = validateReferences(referenceInput?.files || []);
    if (referenceErrors.length) {
      referenceInput?.setCustomValidity(referenceErrors[0]);
      referenceInput?.reportValidity();
      setFormMessage(referenceErrors.join(" "));
      return;
    }

    if (!bookingForm.checkValidity()) {
      bookingForm.reportValidity();
      setFormMessage("Please complete the required fields before sending.");
      return;
    }

    const name = sanitizeText(formData.get("name"));
    const email = sanitizeText(formData.get("email"));
    const mobile = sanitizeText(formData.get("mobile"));
    const style = sanitizeText(formData.get("tattoo_style"));
    const placement = sanitizeText(formData.get("placement"));
    const date = sanitizeText(formData.get("preferred_date"));
    const budget = sanitizeText(formData.get("budget"));
    const notes = sanitizeText(formData.get("concept_notes"));

    formData.set("name", name);
    formData.set("email", email);
    formData.set("mobile", mobile);
    formData.set("tattoo_style", style);
    formData.set("placement", placement);
    formData.set("preferred_date", date);
    formData.set("budget", budget);
    formData.set("concept_notes", notes);
    formData.set("_subject", `Tattoo booking request${name ? ` - ${name}` : ""}`);
    formData.set("_replyto", email);
    formData.delete("reference_upload");

    [...(referenceInput?.files || [])].forEach((file) => {
      formData.append("reference_upload", file, file.name);
    });

    const sanitizedValues = {
      name,
      email,
      mobile,
      tattoo_style: style,
      placement,
      preferred_date: date,
      budget,
      concept_notes: notes
    };

    lastBookingSubmissionAt = now;
    submitButton.disabled = true;
    submitButton.setAttribute("aria-busy", "true");
    setFormMessage("Sending your booking request...");

    fetch(bookingForm.action, {
      method: "POST",
      body: formData,
      headers: {
        Accept: "application/json"
      }
    })
      .then(async (response) => {
        if (!response.ok) {
          let message = "Formspree submission failed.";

          try {
            const data = await response.json();
            message = data?.errors?.[0]?.message || data?.error || message;
          } catch {
            message = response.statusText || message;
          }

          throw new Error(message);
        }

        bookingForm.reset();
        setFormMessage(`Thanks${name ? `, ${name}` : ""}. Your booking request has been sent.`);
        window.setTimeout(() => {
          submitButton.disabled = false;
        }, submissionCooldownMs);
      })
      .catch(() => {
        if (window.location.protocol === "file:") {
          applySanitizedValuesToForm(sanitizedValues);
          setFormMessage("Opening the secure booking request page...");
          bookingForm.submit();
          return;
        }

        lastBookingSubmissionAt = 0;
        submitButton.disabled = false;
        setFormMessage("Sorry, the booking request could not be sent. Please try again.");
      })
      .finally(() => {
        submitButton.removeAttribute("aria-busy");
      });
  });
}
