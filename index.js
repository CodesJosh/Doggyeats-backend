import 'dotenv/config'; 
import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import Transbank from 'transbank-sdk'; 
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import nodemailer from 'nodemailer'; 

// Importamos los modelos
import { Order } from './models/Order.js';
import { User } from './models/User.js';
import { Product } from './models/Product.js'; 
import { Coupon } from './models/Coupons.js'; // <--- CORREGIDO: Importamos 'Coupon' (Singular) del archivo 'Coupons.js'

const { WebpayPlus, Options, IntegrationApiKeys, IntegrationCommerceCodes, Environment } = Transbank;

const app = express();
const port = process.env.PORT || 5000;
const SECRET_KEY = process.env.JWT_SECRET; 

// --- CONFIGURACIÓN ---
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true })); 

mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/doggyeats')
  .then(() => console.log('🍃 MongoDB Conectado Exitosamente'))
  .catch(err => console.error('❌ Error al conectar MongoDB:', err));

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// ==========================================
//  RUTAS DE CUPONES (CLIENTE + ADMIN) 🎟️
// ==========================================

// 1. VALIDAR CUPÓN (Para el Carrito del Cliente)
app.post('/api/coupons/validate', async (req, res) => {
  try {
    const { code, userEmail } = req.body;
    // Usamos 'Coupon' en singular porque así se llama la variable del modelo
    const coupon = await Coupon.findOne({ code: code.toUpperCase() });
    
    if (!coupon) return res.status(404).json({ error: "Cupón no existe" });
    if (!coupon.isActive) return res.status(400).json({ error: "Cupón inactivo" });
    
    if (coupon.usedBy.includes(userEmail)) {
      return res.status(400).json({ error: "Ya utilizaste este cupón anteriormente" });
    }

    res.json({ 
      message: "Cupón aplicado", 
      discountPercent: coupon.discountPercent, 
      code: coupon.code 
    });
  } catch (error) {
    res.status(500).json({ error: "Error al validar cupón" });
  }
});

// 2. CREAR UN NUEVO CUPÓN (Para el Panel Admin)
app.post('/api/coupons', async (req, res) => {
  try {
    const { code, discountPercent, expirationDate } = req.body;
    
    const existing = await Coupon.findOne({ code: code.toUpperCase() });
    if (existing) return res.status(400).json({ error: "Este código ya existe" });

    const newCoupon = new Coupon({ 
      code: code.toUpperCase(), 
      discountPercent, 
      expirationDate,
      usedBy: [] 
    });
    
    await newCoupon.save();
    res.json(newCoupon);
  } catch (error) {
    res.status(500).json({ error: "Error al crear cupón" });
  }
});

// 3. OBTENER TODOS LOS CUPONES (Para el Panel Admin)
app.get('/api/coupons', async (req, res) => {
  try {
    const coupons = await Coupon.find().sort({ createdAt: -1 });
    res.json(coupons);
  } catch (error) {
    res.status(500).json({ error: "Error al obtener cupones" });
  }
});

// 4. ELIMINAR CUPÓN (Para el Panel Admin)
app.delete('/api/coupons/:id', async (req, res) => {
  try {
    await Coupon.findByIdAndDelete(req.params.id);
    res.json({ message: "Cupón eliminado" });
  } catch (error) {
    res.status(500).json({ error: "Error al eliminar cupón" });
  }
});

// ==========================================
//  RUTAS DE AUTENTICACIÓN
// ==========================================
app.post('/api/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    const existingUser = await User.findOne({ email });
    if (existingUser) return res.status(400).json({ error: "El correo ya está registrado" });

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({ name, email, password: hashedPassword });
    await newUser.save();
    res.status(201).json({ message: "Usuario creado con éxito" });
  } catch (error) {
    res.status(500).json({ error: "Error al registrar usuario" });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ error: "Usuario no encontrado" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ error: "Contraseña incorrecta" });

    const token = jwt.sign({ id: user._id, role: user.role }, SECRET_KEY, { expiresIn: '1h' });
    
    res.json({ token, user: { name: user.name, email: user.email, role: user.role } });
  } catch (error) {
    res.status(500).json({ error: "Error al iniciar sesión" });
  }
});

// ==========================================
//  RUTAS DE PERFIL
// ==========================================
app.get('/api/user/:email', async (req, res) => {
  try {
    const user = await User.findOne({ email: req.params.email });
    if (!user) return res.status(404).json({ error: "Usuario no encontrado" });
    res.json({ name: user.name, email: user.email, myPet: user.myPet, savedAddress: user.savedAddress });
  } catch (error) { res.status(500).json({ error: "Error al obtener perfil" }); }
});

app.put('/api/user/update', async (req, res) => {
  try {
    const { email, myPet, savedAddress } = req.body;
    await User.findOneAndUpdate({ email }, { myPet, savedAddress });
    res.json({ message: "Perfil actualizado correctamente" });
  } catch (error) { res.status(500).json({ error: "Error al actualizar perfil" }); }
});

// ==========================================
//  RUTAS DE NEWSLETTER
// ==========================================
app.post('/api/subscribe', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: "Falta el email" });

  try {
    await transporter.sendMail({
      from: `"DoggyEats 🐶" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "¡Bienvenido a la manada! Aquí tienes tu descuento 🎁",
      html: `
        <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #eee; border-radius: 10px; overflow: hidden;">
          <div style="background-color: #6b21a8; color: white; padding: 20px; text-align: center;">
            <h1 style="margin: 0;">¡Bienvenido a DoggyEats! 🐾</h1>
          </div>
          <div style="padding: 20px;">
            <p>Hola,</p>
            <p>Gracias por suscribirte a nuestro newsletter. Tu peludo te lo agradecerá.</p>
            <div style="background-color: #f3e8ff; padding: 20px; border-radius: 10px; text-align: center; margin: 20px 0; border: 2px dashed #6b21a8;">
              <p style="margin: 0; font-weight: bold; color: #6b21a8;">TU CUPÓN DE BIENVENIDA:</p>
              <h2 style="color: #6b21a8; font-size: 30px; margin: 10px 0;">DOGGYNEW10</h2>
              <p style="font-size: 12px; color: #666; margin: 0;">Válido por 10% de descuento en tu primera compra.</p>
            </div>
            <p>¡Nos vemos en la tienda!</p>
          </div>
          <div style="background-color: #f9fafb; padding: 15px; text-align: center; font-size: 12px; color: #999;">
            © ${new Date().getFullYear()} DoggyEats SpA. Todos los derechos reservados.
          </div>
        </div>
      `
    });
    console.log(`📧 Cupón enviado a: ${email}`);
    res.json({ message: "Correo enviado con éxito" });
  } catch (error) {
    console.error("Error enviando correo:", error);
    res.status(500).json({ error: "Error al enviar el correo" });
  }
});

// ==========================================
//  RUTAS DE PRODUCTOS
// ==========================================
app.get('/api/products', async (req, res) => {
  try {
    const products = await Product.find();
    res.json(products);
  } catch (error) { res.status(500).json({ error: "Error al obtener productos" }); }
});

app.get('/api/products/search/:query', async (req, res) => {
  try {
    const query = req.params.query;
    const products = await Product.find({
      $or: [
        { name: { $regex: query, $options: 'i' } },
        { category: { $regex: query, $options: 'i' } },
        { description: { $regex: query, $options: 'i' } }
      ]
    });
    res.json(products);
  } catch (error) {
    res.status(500).json({ error: "Error en la búsqueda" });
  }
});

app.get('/api/products/:id', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ error: "Producto no encontrado" });
    res.json(product);
  } catch (error) { res.status(500).json({ error: "Error al buscar producto" }); }
});

app.post('/api/products', async (req, res) => {
  try {
    const newProduct = new Product(req.body);
    await newProduct.save();
    console.log("📦 Producto creado:", newProduct.name);
    res.json(newProduct);
  } catch (error) { res.status(500).json({ error: "Error al crear producto" }); }
});

app.post('/api/products/:id/review', async (req, res) => {
  try {
    const { user, rating, comment } = req.body;
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ error: "Producto no encontrado" });

    const newReview = { user, rating: Number(rating), comment };
    product.reviews.push(newReview);
    
    await product.save();
    res.json(product); 
  } catch (error) {
    res.status(500).json({ error: "Error al guardar reseña" });
  }
});

app.delete('/api/products/:id', async (req, res) => {
  try {
    await Product.findByIdAndDelete(req.params.id);
    console.log("🗑️ Producto eliminado:", req.params.id);
    res.json({ message: "Producto eliminado" });
  } catch (error) { res.status(500).json({ error: "Error al eliminar producto" }); }
});

app.delete('/api/products/:productId/reviews/:reviewId', async (req, res) => {
  try {
    const { productId, reviewId } = req.params;
    const updatedProduct = await Product.findByIdAndUpdate(
      productId,
      { $pull: { reviews: { _id: reviewId } } }, 
      { new: true } 
    );
    res.json(updatedProduct);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error al eliminar la reseña" });
  }
});

// ==========================================
//  RUTA DASHBOARD (ESTADÍSTICAS)
// ==========================================
app.get('/api/dashboard/stats', async (req, res) => {
  try {
    const productCount = await Product.countDocuments();
    const validStatuses = ['PAID', 'PREPARING', 'SHIPPED', 'DELIVERED', 'COMPLETED'];
    const orders = await Order.find({ status: { $in: validStatuses } }).sort({ createdAt: 1 });

    const totalSales = orders.reduce((acc, order) => acc + order.amount, 0);
    const totalOrders = orders.length;

    const salesMap = {};
    orders.forEach(order => {
        const date = new Date(order.createdAt).toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit' });
        salesMap[date] = (salesMap[date] || 0) + order.amount;
    });

    const chartData = Object.keys(salesMap).map(date => ({
        name: date,
        ventas: salesMap[date]
    })).slice(-7); 

    res.json({ totalSales, totalOrders, productCount, chartData });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error obteniendo estadísticas" });
  }
});

// ==========================================
//  RUTAS DE PEDIDOS Y PAGOS
// ==========================================
app.get('/api/orders/:email', async (req, res) => {
  try {
    const { email } = req.params;
    const orders = await Order.find({ userEmail: email }).sort({ createdAt: -1 });
    res.json(orders);
  } catch (error) { res.status(500).json({ error: "Error al obtener órdenes" }); }
});

app.get('/api/all-orders', async (req, res) => {
  try {
    const orders = await Order.find().sort({ createdAt: -1 });
    res.json(orders);
  } catch (error) { res.status(500).json({ error: "Error al obtener todas las órdenes" }); }
});

app.delete('/api/orders/:id', async (req, res) => {
  try {
    await Order.findByIdAndDelete(req.params.id);
    res.json({ message: "Orden eliminada correctamente" });
  } catch (error) { res.status(500).json({ error: "Error al eliminar la orden" }); }
});

app.put('/api/orders/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    const updatedOrder = await Order.findByIdAndUpdate(req.params.id, { status }, { new: true });
    res.json(updatedOrder);
  } catch (error) { res.status(500).json({ error: "Error al actualizar estado" }); }
});

// -----------------------------------------------------------------
// TRANSBANK: CREAR TRANSACCIÓN (Con lógica de Cupón) 🎟️
// -----------------------------------------------------------------
app.post('/api/create-transaction', async (req, res) => {
  try {
    // 1. Recibimos couponCode (si existe) desde el frontend
    const { amount, shipping, items, userEmail, couponCode } = req.body; 
    
    const buyOrder = "O-" + Date.now(); 
    const sessionId = "S-" + Date.now();
    
    // 2. Guardamos la orden con el cupón en estado "pendiente"
    const newOrder = new Order({ 
        buyOrder, 
        sessionId, 
        amount, 
        shipping, 
        items, 
        userEmail,
        couponUsed: couponCode || null // <--- GUARDAMOS EL INTENTO DE USO
    });
    
    await newOrder.save();
    
    const returnUrl = "http://localhost:5000/api/commit";
    const createResponse = await (new WebpayPlus.Transaction(new Options(IntegrationCommerceCodes.WEBPAY_PLUS, IntegrationApiKeys.WEBPAY, Environment.Integration))).create(buyOrder, sessionId, amount, returnUrl);
    
    res.json({ token: createResponse.token, url: createResponse.url });
  } catch (error) { res.status(500).json({ error: "Error al iniciar pago" }); }
});

// -----------------------------------------------------------------
// TRANSBANK: CONFIRMAR TRANSACCIÓN (Y quemar cupón) 🔥
// -----------------------------------------------------------------
app.use('/api/commit', async (req, res) => {
  try {
    const token = req.body?.token_ws || req.query?.token_ws;
    if (!token) return res.redirect('http://localhost:5173/cart?status=cancelled');

    const commitResponse = await (new WebpayPlus.Transaction(new Options(IntegrationCommerceCodes.WEBPAY_PLUS, IntegrationApiKeys.WEBPAY, Environment.Integration))).commit(token);

    if (commitResponse.status === 'AUTHORIZED') {
      const order = await Order.findOneAndUpdate(
        { buyOrder: commitResponse.buy_order }, 
        { status: 'PAID' }, 
        { new: true }
      );

      if (order) {
        // 1. Descontar Stock de Productos
        for (const item of order.items) {
          await Product.findByIdAndUpdate(item.id, { $inc: { stock: -item.quantity } });
        }

        // 2. QUEMAR EL CUPÓN (Si se usó)
        if (order.couponUsed) {
            await Coupon.findOneAndUpdate(
                { code: order.couponUsed },
                { $push: { usedBy: order.userEmail } } // <--- AGREGAMOS AL USUARIO A LA LISTA
            );
            console.log(`🎫 Cupón ${order.couponUsed} marcado como usado por ${order.userEmail}`);
        }
        
        console.log(`✅ Orden pagada: ${order.buyOrder}`);
      }
      res.redirect(`http://localhost:5173/success?amount=${commitResponse.amount}&order=${commitResponse.buy_order}`);
    } else {
      await Order.findOneAndUpdate({ buyOrder: commitResponse.buy_order }, { status: 'REJECTED' });
      res.redirect('http://localhost:5173/cart?status=rejected');
    }
  } catch (error) { 
    console.error(error);
    res.redirect('http://localhost:5173/cart?status=error'); 
  }
});

// --- INICIAR SERVIDOR ---
app.listen(port, () => {
  console.log(`\n🚀 Backend corriendo en: http://localhost:${port}`);
});