import mongoose from 'mongoose';

const couponSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true, uppercase: true }, // Ej: DOGGYNEW10
  discountPercent: { type: Number, required: true }, // Ej: 10
  expirationDate: { type: Date }, // Opcional: fecha límite
  isActive: { type: Boolean, default: true },
  usedBy: [{ type: String }] // <--- AQUÍ GUARDAMOS LOS EMAILS DE QUIENES LO USARON
});

export const Coupon = mongoose.model('Coupon', couponSchema);