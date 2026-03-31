import mongoose from 'mongoose';

const productSchema = new mongoose.Schema({
  name: { type: String, required: true },
  price: { type: Number, required: true },
  category: { type: String, required: true },
  image: { type: String, required: true }, 
  description: { type: String, default: '' },
  stock: { type: Number, default: 100 },
  
  // --- NUEVA SECCIÓN: RESEÑAS ---
  reviews: [
    {
      user: { type: String, required: true },
      rating: { type: Number, required: true },
      comment: { type: String, required: true },
      date: { type: Date, default: Date.now } 
    }
  ]
});

export const Product = mongoose.model('Product', productSchema);