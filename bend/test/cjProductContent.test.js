const test = require("node:test");
const assert = require("node:assert/strict");
const { extractCjImageUrls, sanitizeCjDescription } = require("../utils/cjProductContent");

test("CJ product content strips HTML while retaining readable product details", () => {
  const description = '<p><b>Product information:</b><br/>Material: ABS</p><p><br/></p><b>Packing list:</b><br/>1 x cooling fan&nbsp;</p><b>Product Image:</b><img src="https://cf.cjdropshipping.com/a.jpg"/>';

  assert.equal(
    sanitizeCjDescription(description),
    "Product information:\nMaterial: ABS\n\nPacking list:\n1 x cooling fan"
  );
});

test("CJ product content collects description and gallery image URLs once", () => {
  const images = extractCjImageUrls({
    mainImage: "https://cf.cjdropshipping.com/main.jpg",
    productImage: ["https://cf.cjdropshipping.com/one.jpg", "https://cf.cjdropshipping.com/two.jpg"],
    description: '<p>Details</p><img src="https://cf.cjdropshipping.com/two.jpg"/><img src="https://cf.cjdropshipping.com/three.jpg"/>',
  });

  assert.deepEqual(images, [
    "https://cf.cjdropshipping.com/main.jpg",
    "https://cf.cjdropshipping.com/one.jpg",
    "https://cf.cjdropshipping.com/two.jpg",
  ]);
  assert.deepEqual(
    extractCjImageUrls('<img src="https://cf.cjdropshipping.com/two.jpg"/><img src="https://cf.cjdropshipping.com/three.jpg"/>'),
    ["https://cf.cjdropshipping.com/two.jpg", "https://cf.cjdropshipping.com/three.jpg"]
  );
});
