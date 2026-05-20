const Cart = require("../models/cartModel");
const Product = require("../models/product");

exports.addToCart = async (req, res) => {
  try {
    const { productId, quantity } = req.body;
    if (quantity <= 0) {
      return res.status(400).json({ message: "Invalid quantity" });
    }

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    if (product.stock < quantity) {
      return res.status(400).json({ message: "Not enough stock" });
    }

    let cart = await Cart.findOne({ user: req.user._id });

    if (!cart) {
      cart = new Cart({ user: req.user._id, items: [] });
    }

    const existingItem = cart.items.find(
      (item) => item.product.toString() === productId,
    );
    if (existingItem) {
      const newQuantity = existingItem.quantity + quantity;
      if (newQuantity > product.stock) {
        return res.status(400).json({ message: "Exceeds stock limit" });
      }
      existingItem.quantity = newQuantity;
    } else {
      cart.items.push({
        product: product._id,
        vendor: product.vendor,
        quantity,
      });
    }
    await cart.save();
    res.json({ message: "Added to cart" });
  } catch (error) {
    res.status(400).json({
      message: error.message,
    });
  }
};

exports.getCart = async (req, res) => {
  try {
    const cart = await Cart.findOne({ user: req.user._id }).populate(
      "items.product",
    );
    if (!cart) {
      return res.json({ items: [], totalPrice: 0 });
    }

    let totalPrice = 0;

    const updatedItems = cart.items
      .map((item) => {
        const product = item.product;

        if (!product) return null;

        totalPrice += product.price * item.quantity;

        return {
          product: product._id,
          name: product.name,
          image: product.images,
          vendor: item.vendor,
          price: product.price,
          quantity: item.quantity,
          stock: product.stock,
        };
      })
      .filter(Boolean);

    res.json({
      items: updatedItems,
      totalPrice,
    });
  } catch (error) {}
};

exports.updateCartItem = async (req, res) => {
  try {
    const { quantity } = req.body;
    if (quantity <= 0) {
      return res
        .status(400)
        .json({ message: "Quantity must be greater than 0" });
    }
    const cart = await Cart.findOne({ user: req.user._id });

    if (!cart) {
      return res.status(404).json({ message: "Cart not found" });
    }

    const item = cart.items.find(
      (item) => item.product.toString() === req.params.productId,
    );
    if (!item) {
      return res.status(404).json({ message: "Item not found in cart" });
    }

    const product = await Product.findById(item.product);

    if (quantity > product.stock) {
      return res.status(400).json({ message: "Not enough stock available" });
    }

    item.quantity = quantity;

    await cart.save();

    res.json({ message: "Cart updated", cart });
  } catch (error) {
    res.status(400).json({
      message: error.message,
    });
  }
};

exports.removeCartItem = async(req,res)=>{
  const cart = await Cart.findOne({user:req.user._id});
  if(!cart)
  {
    return res.status(400).json({message:"Cart not found"});

  }

  cart.items = cart.items.filter(
    item=>item.product.toString()!==req.params.productId
  );
await cart.save();

  res.json({ message: "Item removed from cart", cart });
}


exports.clearCart = async (req, res) => {
  const cart = await Cart.findOne({ user: req.user._id });

  if (!cart) {
    return res.status(404).json({ message: "Cart not found" });
  }

  cart.items = [];

  await cart.save();

  res.json({ message: "Cart cleared" });
};