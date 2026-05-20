const categories = [
  "electronics",
  "fashion",
  "home",
  "fitness",
  "accessories",
  "furniture",
];

const productNames = [
  "Pro", "Max", "Ultra", "Lite", "Plus",
  "Smart", "Prime", "Air", "Flex", "Elite"
];

const baseItems = [
  "Headphones",
  "Shoes",
  "Watch",
  "Backpack",
  "Keyboard",
  "Speaker",
  "T-Shirt",
  "Lamp",
  "Bottle",
  "Power Bank"
];

function getRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateProducts(count, vendorId) {
  const products = [];

  for (let i = 0; i < count; i++) {
    const name = `${getRandom(productNames)} ${getRandom(baseItems)}`;

    products.push({
      name,
      description: `High quality ${name} with premium build.`,
      price: Math.floor(Math.random() * 5000) + 300, // 300 – 5300
      category: getRandom(categories),
      stock: Math.floor(Math.random() * 100) + 1,
      vendor: vendorId
    });
  }

  return products;
}

module.exports = generateProducts;