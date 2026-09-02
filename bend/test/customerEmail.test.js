const test = require("node:test");
const assert = require("node:assert/strict");
const {
  getSignupMarketingSteps,
  getWelcomeStep,
  readCustomerEmailJourney,
} = require("../utils/customerEmailJourney");
const { buildCustomerJourneyEmail } = require("../utils/sendpulse");

test("customer journey resolves the welcome step and leaves delayed triggers alone", () => {
  const journey = readCustomerEmailJourney();
  assert.equal(getWelcomeStep(journey).stage, "Welcome");
  assert.deepEqual(getSignupMarketingSteps(journey), []);
});

test("customer marketing email content escapes plain text and includes preference management", () => {
  const email = buildCustomerJourneyEmail({
    config: { brandName: "Weluxo", appBaseUrl: "https://store.example.com" },
    recipientName: "Taylor <Customer>",
    marketing: true,
    step: { subject: "A\nsubject", body: "Hello <script>alert(1)</script>", cta: "Shop", href: "/shop" },
  });

  assert.equal(email.subject, "A subject");
  assert.match(email.html, /Hello/);
  assert.doesNotMatch(email.html, /<script>/i);
  assert.match(email.html, /https:\/\/store\.example\.com\/account\/settings/);
  assert.match(email.text, /https:\/\/store\.example\.com\/shop/);
});
