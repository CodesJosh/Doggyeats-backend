import mongoose from "mongoose";

const UserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true }, 
  role: { type: String, default: 'user' },
  
  myPet: {
    name: { type: String, default: '' },
    type: { type: String, default: '' }, 
    age: { type: Number, default: 0 }
  },

  savedAddress: {
    address: { type: String, default: '' },
    city: { type: String, default: '' },
    phone: { type: String, default: '' }
  },
  
  createdAt: { type: Date, default: Date.now }
});

export const User = mongoose.model('User', UserSchema);