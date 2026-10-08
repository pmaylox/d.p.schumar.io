"use strict";

const contactForm = document.getElementById("contact-form");
const contactStatus = document.getElementById("contact-form-status");
const contactFields = contactForm.querySelectorAll("input, textarea");

contactForm.noValidate = true;

function validateContactField(field) {
    field.setCustomValidity("");

    if (!field.value.trim()) {
        field.setCustomValidity("Please enter a value, not just spaces.");
    }
}

contactForm.addEventListener("input", (event) => {
    if (event.target.matches("input, textarea")) {
        validateContactField(event.target);
        contactStatus.textContent = "Message sending is not enabled yet. This form only checks your entries.";
    }
});

contactForm.addEventListener("submit", (event) => {
    event.preventDefault();

    for (const field of contactFields) {
        validateContactField(field);
    }

    if (!contactForm.reportValidity()) {
        contactStatus.textContent = "Please correct the highlighted field. No message has been sent.";
        return;
    }

    contactStatus.textContent = "Your entries are valid. No message has been sent because message sending is not enabled yet.";
});
