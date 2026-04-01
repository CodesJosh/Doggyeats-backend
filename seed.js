import 'dotenv/config';
import mongoose from 'mongoose';
import { Product } from './models/Product.js';

// ✅ Usa la variable de entorno en lugar de URI hardcodeada
mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/doggyeats')
  .then(() => console.log('🍃 MongoDB Conectado para Seed'))
  .catch(err => console.error(err));

const products = [
  // --- PERROS ---
  {
    name: "Master Dog Adulto 18kg",
    category: "Perros",
    price: 24990,
    stock: 50,
    image: "https://www.masterdog.cl/wp-content/uploads/2021/03/Master-Dog-Adulto-Carne-Arroz-15-kg-1.png",
    description: "Alimento completo para perros adultos de todas las razas. Fórmula reforzada con proteínas de alta calidad."
  },
  {
    name: "Pedigree Cachorro 10kg",
    category: "Perros",
    price: 18990,
    stock: 30,
    image: "https://jumbocolombiafood.vteximg.com.br/arquivos/ids/3482522-1000-1000/7702084042852-1.jpg",
    description: "Crecimiento sano y fuerte para tu cachorro. Contiene calcio y leche para huesos fuertes."
  },
  {
    name: "Dog Chow Adultos Minis y Pequeños",
    category: "Perros",
    price: 15990,
    stock: 100,
    image: "https://dojiw2m9tvv09.cloudfront.net/11132/product/dog-chow-adultos-minis-y-pequenos-15-meses-a-7-anos-21808.png",
    description: "Nutrición especializada para maximizar la calidad de vida de tu perro de raza pequeña."
  },
  {
    name: "Royal Canin Maxi Adult",
    category: "Perros",
    price: 65990,
    stock: 10,
    image: "https://www.royalcanin.com/cl/dogs/products/retail-products/maxi-adult-dry/-/media/c6e3b8f5f6e84d0fa3e5f4a5f6e84d0f.jpg",
    description: "Alta gama para perros grandes. Ayuda a mantener un peso ideal y huesos saludables."
  },

  // --- GATOS ---
  {
    name: "Whiskas Carne 10kg",
    category: "Gatos",
    price: 22990,
    stock: 40,
    image: "https://www.whiskas.cl/cdn-cgi/image/format=auto,q=90/sites/g/files/fnmzdf2036/files/2022-10/7790742250209-product-image-1.png",
    description: "Deliciosos trocitos con sabor a carne. Nutrición 100% completa y balanceada para gatos adultos."
  },
  {
    name: "Cat Chow Defense Plus",
    category: "Gatos",
    price: 19990,
    stock: 60,
    image: "https://jumbocolombiafood.vteximg.com.br/arquivos/ids/3823793-1000-1000/7501072208030-1.jpg",
    description: "Fortalece las defensas naturales de tu gato. Rico en vitaminas y antioxidantes."
  },
  {
    name: "Arena Sanitaria Aglomerante",
    category: "Gatos",
    price: 8990,
    stock: 200,
    image: "https://dojiw2m9tvv09.cloudfront.net/11132/product/arena-sanitaria-aglomerante-con-aroma-a-lavanda-4kg-top-k99846.jpg",
    description: "Arena con aroma a lavanda, máximo control de olores y fácil limpieza."
  },

  // --- VETERINARIA ---
  {
    name: "Pipeta Antipulgas Power",
    category: "Veterinaria",
    price: 12990,
    stock: 150,
    image: "https://pipero.cl/wp-content/uploads/2021/02/Power-Ultra-Perros-2.jpg",
    description: "Protección total contra pulgas, garrapatas y mosquitos. Aplicación mensual."
  },
  {
    name: "Vitaminas DoggyVit",
    category: "Veterinaria",
    price: 14990,
    stock: 80,
    image: "https://sc04.alicdn.com/kf/H8f3f8f8f8f8f4f8f8f8f8f8f8f8f8f8f.jpg",
    description: "Suplemento vitamínico para mejorar el pelaje y la energía de tu mascota."
  },
  {
    name: "Shampoo Hipoalergénico",
    category: "Veterinaria",
    price: 6990,
    stock: 45,
    image: "https://animalpro.cl/wp-content/uploads/2021/06/shampoo-hipoalergenico-perros-gatos-traper-250ml.jpg",
    description: "Ideal para mascotas con piel sensible. Sin colorantes ni perfumes fuertes."
  }
];

const seedDB = async () => {
  try {
    await Product.deleteMany({});
    console.log("🧹 Productos anteriores eliminados...");

    await Product.insertMany(products);
    console.log("✅ ¡Catálogo insertado correctamente!");
    console.log(`📦 Se agregaron ${products.length} productos.`);
  } catch (error) {
    console.error("❌ Error en el seed:", error);
  } finally {
    mongoose.connection.close();
  }
};

seedDB();