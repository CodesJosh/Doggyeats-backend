import mongoose from 'mongoose';

const OrderSchema = new mongoose.Schema({
  // Datos de Transbank
  buyOrder: { type: String, required: true, unique: true },
  sessionId: { type: String, required: true },
  amount: { type: Number, required: true },
  status: { type: String, default: 'PENDING' }, // PENDING, PAID, REJECTED, PREPARING, SHIPPED, DELIVERED
  
  // Datos del Cliente
  userEmail: { type: String, required: true }, 

  // Datos de Envío
  shipping: {
    address: { type: String, required: true },
    city: { type: String, required: true },
    phone: { type: String, required: true }
  },
  
  // Productos comprados
  items: [
    {
      id: String, // Importante para descontar stock
      name: String,
      price: Number,
      quantity: Number,
      image: String 
    }
  ],
  
  // --- NUEVO CAMPO PARA CUPONES 🎟️ ---
  // Aquí guardamos el código (ej: "DOGGYNEW10") si usaron uno.
  couponUsed: { type: String, default: null },

  createdAt: { type: Date, default: Date.now }
});

export const Order = mongoose.model('Order', OrderSchema);