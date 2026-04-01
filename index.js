import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import Transbank from 'transbank-sdk';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import nodemailer from 'nodemailer';

// --- SEGURIDAD ---
import { rateLimit } from 'express-rate-limit';
import helmet from 'helmet';
import xss from 'xss-clean';
import mongoSanitize from 'express-mongo-sanitize';

// Importamos los modelos
import { Order } from './models/Order.js';
import { User } from './models/User.js';
import { Product } from './models/Product.js';
import { Coupon } from './models/Coupons.js';

const { WebpayPlus, Options, IntegrationApiKeys, IntegrationCommerceCodes, Environment } = Transbank;

const app = express();
const port = process.env.PORT || 5000;
const SECRET_KEY = process.env.JWT_SECRET;

// --- VARIABLES DE ENTORNO PARA DESPLIEGUE ---
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:5000';

// ==========================================
//  CONFIGURACIÓN DE SEGURIDAD GLOBAL 🛡️
// ==========================================

app.use(helmet());
app.use(mongoSanitize()); // Previene NoSQL Injection
app.use(xss());           // Limpia scripts maliciosos (XSS)

// ✅ CORS restringido al frontend autorizado
app.use(cors({
  origin: FRONTEND_URL,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// ✅ Rate limit general: 100 peticiones cada 15 minutos
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Demasiadas peticiones. Intenta más tarde.' }
});
app.use('/api/', limiter);

// ✅ Rate limit estricto solo para login: 10 intentos cada 15 minutos
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Demasiados intentos de inicio de sesión. Intenta más tarde.' }
});

// ✅ Rate limit para validación de cupones: 20 intentos cada 15 minutos
const couponLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Demasiados intentos de validación. Intenta más tarde.' }
});

// ==========================================
//  MIDDLEWARES DE AUTORIZACIÓN 🔐
// ==========================================

const verifyToken = (req, res, next) => {
  const token = req.headers['authorization']?.split(' ')[1];
  if (!token) return res.status(403).json({ error: "No se proporcionó un token de acceso." });

  jwt.verify(token, SECRET_KEY, (err, decoded) => {
    if (err) return res.status(401).json({ error: "Sesión inválida o expirada." });
    req.user = decoded;
    next();
  });
};

const isAdmin = (req, res, next) => {
  verifyToken(req, res, () => {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: "Acceso denegado: Se requiere rol de administrador." });
    }
    next();
  });
};

// ==========================================
//  CONEXIÓN BASE DE DATOS
// ==========================================
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
//  AUTENTICACIÓN
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
  } catch (error) { res.status(500).json({ error: "Error al registrar usuario" }); }
});

// ✅ Rate limit específico para login
app.post('/api/login', loginLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ error: "Usuario no encontrado" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ error: "Contraseña incorrecta" });

    const token = jwt.sign({ id: user._id, role: user.role }, SECRET_KEY, { expiresIn: '1h' });
    res.json({ token, user: { name: user.name, email: user.email, role: user.role } });
  } catch (error) { res.status(500).json({ error: "Error al iniciar sesión" }); }
});

// ==========================================
//  PERFIL DE USUARIO 🔐 (protegido)
// ==========================================

// ✅ Protegido: solo el usuario autenticado puede ver su perfil
app.get('/api/user/:email', verifyToken, async (req, res) => {
  try {
    // ✅ El usuario solo puede ver su propio perfil, no el de otros
    if (req.user.role !== 'admin' && req.user.email !== req.params.email) {
      return res.status(403).json({ error: "Acceso denegado." });
    }
    const user = await User.findOne({ email: req.params.email });
    if (!user) return res.status(404).json({ error: "Usuario no encontrado" });
    res.json({ name: user.name, email: user.email, myPet: user.myPet, savedAddress: user.savedAddress });
  } catch (error) { res.status(500).json({ error: "Error al obtener perfil" }); }
});

// ✅ Protegido: solo el usuario autenticado puede editar su perfil
app.put('/api/user/update', verifyToken, async (req, res) => {
  try {
    const { email, myPet, savedAddress } = req.body;
    // ✅ El usuario solo puede editar su propio perfil
    if (req.user.role !== 'admin' && req.user.email !== email) {
      return res.status(403).json({ error: "Acceso denegado." });
    }
    await User.findOneAndUpdate({ email }, { myPet, savedAddress });
    res.json({ message: "Perfil actualizado correctamente" });
  } catch (error) { res.status(500).json({ error: "Error al actualizar perfil" }); }
});

// ==========================================
//  NEWSLETTER
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
//  CUPONES 🎟️
// ==========================================

// ✅ Rate limit específico para evitar enumeración de cupones
app.post('/api/coupons/validate', couponLimiter, async (req, res) => {
  try {
    const { code, userEmail } = req.body;
    const coupon = await Coupon.findOne({ code: code.toUpperCase() });
    if (!coupon) return res.status(404).json({ error: "Cupón no existe" });
    if (!coupon.isActive) return res.status(400).json({ error: "Cupón inactivo" });
    if (coupon.usedBy.includes(userEmail)) return res.status(400).json({ error: "Ya utilizaste este cupón" });

    res.json({ message: "Cupón aplicado", discountPercent: coupon.discountPercent, code: coupon.code });
  } catch (error) { res.status(500).json({ error: "Error al validar cupón" }); }
});

// Rutas de administración de cupones — protegidas con isAdmin
app.post('/api/coupons', isAdmin, async (req, res) => {
  try {
    const { code, discountPercent, expirationDate } = req.body;
    const existing = await Coupon.findOne({ code: code.toUpperCase() });
    if (existing) return res.status(400).json({ error: "Este código ya existe" });

    const newCoupon = new Coupon({ code: code.toUpperCase(), discountPercent, expirationDate, usedBy: [] });
    await newCoupon.save();
    res.json(newCoupon);
  } catch (error) { res.status(500).json({ error: "Error al crear cupón" }); }
});

app.get('/api/coupons', isAdmin, async (req, res) => {
  try {
    const coupons = await Coupon.find().sort({ createdAt: -1 });
    res.json(coupons);
  } catch (error) { res.status(500).json({ error: "Error al obtener cupones" }); }
});

app.delete('/api/coupons/:id', isAdmin, async (req, res) => {
  try {
    await Coupon.findByIdAndDelete(req.params.id);
    res.json({ message: "Cupón eliminado" });
  } catch (error) { res.status(500).json({ error: "Error al eliminar cupón" }); }
});

// ==========================================
//  PRODUCTOS
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
  } catch (error) { res.status(500).json({ error: "Error en la búsqueda" }); }
});

app.get('/api/products/:id', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ error: "Producto no encontrado" });
    res.json(product);
  } catch (error) { res.status(500).json({ error: "Error al buscar producto" }); }
});

// ✅ Protegido con isAdmin
app.post('/api/products', isAdmin, async (req, res) => {
  try {
    const newProduct = new Product(req.body);
    await newProduct.save();
    console.log("📦 Producto creado:", newProduct.name);
    res.json(newProduct);
  } catch (error) { res.status(500).json({ error: "Error al crear producto" }); }
});

// ✅ Reseñas: solo usuarios autenticados pueden dejar una
app.post('/api/products/:id/review', verifyToken, async (req, res) => {
  try {
    const { user, rating, comment } = req.body;
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ error: "Producto no encontrado" });

    const newReview = { user, rating: Number(rating), comment };
    product.reviews.push(newReview);
    await product.save();
    res.json(product);
  } catch (error) { res.status(500).json({ error: "Error al guardar reseña" }); }
});

// ✅ Protegido con isAdmin
app.delete('/api/products/:id', isAdmin, async (req, res) => {
  try {
    await Product.findByIdAndDelete(req.params.id);
    console.log("🗑️ Producto eliminado:", req.params.id);
    res.json({ message: "Producto eliminado" });
  } catch (error) { res.status(500).json({ error: "Error al eliminar producto" }); }
});

// ✅ Protegido con isAdmin
app.delete('/api/products/:productId/reviews/:reviewId', isAdmin, async (req, res) => {
  try {
    const { productId, reviewId } = req.params;
    const updatedProduct = await Product.findByIdAndUpdate(
      productId,
      { $pull: { reviews: { _id: reviewId } } },
      { new: true }
    );
    res.json(updatedProduct);
  } catch (error) { res.status(500).json({ error: "Error al eliminar la reseña" }); }
});

// ==========================================
//  DASHBOARD 🔐 (solo admin)
// ==========================================

app.get('/api/dashboard/stats', isAdmin, async (req, res) => {
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

    const chartData = Object.keys(salesMap).map(date => ({ name: date, ventas: salesMap[date] })).slice(-7);
    res.json({ totalSales, totalOrders, productCount, chartData });
  } catch (error) { res.status(500).json({ error: "Error obteniendo estadísticas" }); }
});

// ==========================================
//  ÓRDENES 🔐 (protegidas)
// ==========================================

// ✅ El usuario solo puede ver sus propias órdenes
app.get('/api/orders/:email', verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin' && req.user.email !== req.params.email) {
      return res.status(403).json({ error: "Acceso denegado." });
    }
    const orders = await Order.find({ userEmail: req.params.email }).sort({ createdAt: -1 });
    res.json(orders);
  } catch (error) { res.status(500).json({ error: "Error al obtener órdenes" }); }
});

// ✅ Solo admin puede ver todas las órdenes
app.get('/api/all-orders', isAdmin, async (req, res) => {
  try {
    const orders = await Order.find().sort({ createdAt: -1 });
    res.json(orders);
  } catch (error) { res.status(500).json({ error: "Error al obtener todas las órdenes" }); }
});

// ✅ Solo admin puede eliminar órdenes
app.delete('/api/orders/:id', isAdmin, async (req, res) => {
  try {
    await Order.findByIdAndDelete(req.params.id);
    res.json({ message: "Orden eliminada correctamente" });
  } catch (error) { res.status(500).json({ error: "Error al eliminar la orden" }); }
});

// ✅ Solo admin puede cambiar el estado de una orden
app.put('/api/orders/:id/status', isAdmin, async (req, res) => {
  try {
    const { status } = req.body;
    const updatedOrder = await Order.findByIdAndUpdate(req.params.id, { status }, { new: true });
    res.json(updatedOrder);
  } catch (error) { res.status(500).json({ error: "Error al actualizar estado" }); }
});

// ==========================================
//  TRANSBANK
// ==========================================

app.post('/api/create-transaction', async (req, res) => {
  try {
    const { amount, shipping, items, userEmail, couponCode } = req.body;
    const buyOrder = "O-" + Date.now();
    const sessionId = "S-" + Date.now();

    const newOrder = new Order({
      buyOrder, sessionId, amount, shipping, items, userEmail,
      couponUsed: couponCode || null
    });
    await newOrder.save();

    const returnUrl = `${BACKEND_URL}/api/commit`;
    const createResponse = await (new WebpayPlus.Transaction(
      new Options(IntegrationCommerceCodes.WEBPAY_PLUS, IntegrationApiKeys.WEBPAY, Environment.Integration)
    )).create(buyOrder, sessionId, amount, returnUrl);

    res.json({ token: createResponse.token, url: createResponse.url });
  } catch (error) { res.status(500).json({ error: "Error al iniciar pago" }); }
});

app.use('/api/commit', async (req, res) => {
  try {
    const token = req.body?.token_ws || req.query?.token_ws;
    if (!token) return res.redirect(`${FRONTEND_URL}/cart?status=cancelled`);

    const commitResponse = await (new WebpayPlus.Transaction(
      new Options(IntegrationCommerceCodes.WEBPAY_PLUS, IntegrationApiKeys.WEBPAY, Environment.Integration)
    )).commit(token);

    if (commitResponse.status === 'AUTHORIZED') {
      const order = await Order.findOneAndUpdate(
        { buyOrder: commitResponse.buy_order },
        { status: 'PAID' },
        { new: true }
      );
      if (order) {
        for (const item of order.items) {
          await Product.findByIdAndUpdate(item.id, { $inc: { stock: -item.quantity } });
        }
        if (order.couponUsed) {
          await Coupon.findOneAndUpdate(
            { code: order.couponUsed },
            { $push: { usedBy: order.userEmail } }
          );
          console.log(`🎫 Cupón ${order.couponUsed} marcado como usado por ${order.userEmail}`);
        }
        console.log(`✅ Orden pagada: ${order.buyOrder}`);
      }
      res.redirect(`${FRONTEND_URL}/success?amount=${commitResponse.amount}&order=${commitResponse.buy_order}`);
    } else {
      await Order.findOneAndUpdate({ buyOrder: commitResponse.buy_order }, { status: 'REJECTED' });
      res.redirect(`${FRONTEND_URL}/cart?status=rejected`);
    }
  } catch (error) {
    console.error(error);
    res.redirect(`${FRONTEND_URL}/cart?status=error`);
  }
});

// --- INICIAR SERVIDOR ---
app.listen(port, () => {
  console.log(`\n🚀 Backend Seguro corriendo en: ${BACKEND_URL}`);
});