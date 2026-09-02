const test = require("node:test");
const assert = require("node:assert/strict");
const {
  orderEventTypeForStatus,
  queueJourneyEvent,
} = require("../utils/customerEmailAutomation");

function fakePool() {
  const queries = [];
  return {
    queries,
    request() {
      const inputs = {};
      const request = {
        input(name, _type, value) {
          inputs[name] = value;
          return request;
        },
        async query(sqlText) {
          queries.push({ sql: sqlText, inputs });
          if (sqlText.includes("OBJECT_ID(N'dbo.CustomerEmailQueue'")) return { recordset: [{ Ready: 1 }] };
          if (sqlText.includes("DECLARE @Inserted")) return { recordset: [{ Inserted: 1 }] };
          return { recordset: [] };
        },
      };
      return request;
    },
  };
}

test("customer journey maps fulfillment statuses to event triggers", () => {
  assert.equal(orderEventTypeForStatus("Packed"), "order_packed");
  assert.equal(orderEventTypeForStatus("Out for Delivery"), "out_for_delivery");
  assert.equal(orderEventTypeForStatus("Delivered"), "order_delivered");
  assert.equal(orderEventTypeForStatus("Processing"), null);
});

test("an account event queues welcome and the delayed no-purchase branch", async () => {
  const pool = fakePool();
  const result = await queueJourneyEvent({
    pool,
    userId: 42,
    email: "customer@example.com",
    name: "Customer",
    eventType: "account_created",
    eventKey: "account-created:42",
    marketingConsent: true,
  });

  assert.equal(result.queued, 2);
  const inserts = pool.queries.filter(({ sql }) => sql.includes("DECLARE @Inserted"));
  assert.equal(inserts.length, 2);
  assert.ok(inserts.some(({ inputs }) => inputs.StepKey === "welcome" && inputs.ScheduledAt instanceof Date));
  assert.ok(inserts.some(({ inputs }) => inputs.StepKey === "browse-inspiration" && inputs.ScheduledAt.getTime() > Date.now() + 23 * 60 * 60_000));
});
