"use strict";

(() => {
    const form = document.getElementById("contact-form");
    if (!form) return;
    const status = document.getElementById("contact-form-status");
    const button = form.querySelector('button[type="submit"]');
    const fields = form.querySelectorAll('input:not([type="hidden"]):not([name="website"]), textarea');
    const endpoint = window.CONTACT_FORM_ENDPOINT || "";
    const enabled = /^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(endpoint);

    if (enabled) {
        form.action = endpoint;
        status.textContent = "Submitting opens a confirmation in a new tab.";
    } else {
        button.disabled = true;
        status.textContent = "Message sending is not enabled yet. Please check back later.";
    }

    form.noValidate = true;
    const id = form.querySelector('[name="submission-id"]');
    const newId = () => { id.value = crypto.randomUUID(); };
    newId();

    const validate = field => {
        field.setCustomValidity("");
        if (!field.value.trim()) field.setCustomValidity("Please enter a value, not just spaces.");
    };
    form.addEventListener("input", event => {
        if (Array.from(fields).includes(event.target)) {
            validate(event.target);
            newId();
        }
    });
    form.addEventListener("submit", event => {
        for (const field of fields) validate(field);
        if (!enabled || !form.reportValidity()) {
            event.preventDefault();
            status.textContent = enabled ? "Please correct the highlighted field." : "Message sending is not enabled yet.";
            return;
        }
        // Native POST avoids relying on cross-origin AJAX or opaque responses.
        // Only the receiver's confirmation tab can confirm that the data was saved.
        status.textContent = "Check the new tab to see whether your message was received.";
    });
})();
