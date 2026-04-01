# 🐶 DoggyEats - Backend 🐾

![NodeJS](https://img.shields.io/badge/Node.js-43853D?style=for-the-badge&logo=node.js&logoColor=white)
![Express](https://img.shields.io/badge/Express.js-404D59?style=for-the-badge)
![MongoDB](https://img.shields.io/badge/MongoDB-4EA94B?style=for-the-badge&logo=mongodb&logoColor=white)
![JWT](https://img.shields.io/badge/JWT-black?style=for-the-badge&logo=JSON%20web%20tokens)
![JavaScript](https://img.shields.io/badge/JavaScript-323330?style=for-the-badge&logo=javascript&logoColor=F7DF1E)
![NPM](https://img.shields.io/badge/npm-CB3837?style=for-the-badge&logo=npm&logoColor=white)
![License](https://img.shields.io/badge/license-MIT-green?style=for-the-badge)

---

## 📖 Descripción

**DoggyEats Backend** es la API RESTful que sirve como motor principal para la plataforma e-commerce de productos para mascotas. Está construida sobre un entorno robusto y escalable utilizando **Node.js y Express**.

Proporciona toda la lógica de negocio y persistencia de datos, incluyendo:

- 🔐 Autenticación y autorización segura de usuarios mediante **JSON Web Tokens (JWT)**.
- 📦 Gestión de catálogo de productos, inventario (stock) y sistema de reseñas.
- 🎟️ Sistema dinámico de cupones de descuento (creación, validación y control de uso).
- 💳 Integración directa con **Transbank Webpay Plus** para el procesamiento seguro de pagos.
- 📧 Envío automatizado de correos electrónicos (Newsletter y cupones de bienvenida) usando **Nodemailer**.

---

## 🚀 Tech Stack

- 🟢 **Node.js** — Entorno de ejecución en el servidor.
- 🚂 **Express (^5.2.1)** — Framework web minimalista para el enrutamiento y manejo de peticiones HTTP.
- 🍃 **MongoDB & Mongoose (^9.0.2)** — Base de datos NoSQL y ODM (Object Data Modeling).
- 🔑 **Bcryptjs (^3.0.3) & JWT (^9.0.3)** — Hasheo de contraseñas y emisión de tokens de seguridad.
- 💸 **Transbank SDK (^6.1.1)** — Pasarela de pagos oficial para Chile.
- 📨 **Nodemailer (^7.0.12)** — Servicio SMTP para envío de emails transaccionales.

---

## 📋 Prerrequisitos

Asegúrate de tener instalado y configurado:

- Node.js (v18 o superior)
- npm / yarn
- **MongoDB** (Instancia local ejecutándose en el puerto `27017` o un clúster de MongoDB Atlas).

---

## ⚙️ Instalación y Uso

### 1️⃣ Clonar el repositorio
```bash
git clone [https://github.com/tu-usuario/doggyeats-backend.git](https://github.com/tu-usuario/doggyeats-backend.git)
cd doggyeats-backend
```
2️⃣ Instalar dependencias
```bash
npm install
```
3️⃣ Ejecutar en entorno de desarrollo
El proyecto utiliza nodemon para reiniciar automáticamente el servidor al detectar cambios.
```bash
npm run dev
```
4️⃣ Ejecutar para Producción
```bash
npm start
```
📍 La API estará disponible en: http://localhost:5000 (o el puerto definido en tus variables de entorno).

📁 Estructura del Proyecto
```bash
doggyeats-backend/
├── models/                 # Modelos de datos (Mongoose Schemas)
│   ├── Coupons.js          # Esquema de Cupones
│   ├── Order.js            # Esquema de Pedidos/Órdenes
│   ├── Product.js          # Esquema de Productos (incluye reseñas)
│   └── User.js             # Esquema de Usuarios
├── index.js                # Punto de entrada principal y definición de Rutas (Endpoints)
├── package.json            # Configuración de dependencias y scripts
└── .env                    # Variables de entorno (No se sube al repositorio)
```
✨ Características Técnicas Principales

🛒 Procesamiento de Pagos Seguros

Flujo completo de compra integrado con transbank-sdk:

  - Creación de transacción en /api/create-transaction.

  - Redirección y captura de pago en /api/commit.

  - Actualización de inventario automático post-pago y validación/quemado de cupones utilizados.

🎟️ Motor de Cupones y Descuentos

  - Validación de cupones inactivos o caducados.

  - Bloqueo de uso múltiple por un mismo usuario (validación de array usedBy).

📊 Dashboard de Administración

  - Endpoint /api/dashboard/stats que calcula métricas vitales del e-commerce: total de ventas, órdenes generadas, conteo de productos y gráficas de ventas de los últimos 7 días.

🔐 Variables de Entorno

Para conectar correctamente la base de datos, el proveedor de correos y la seguridad JWT, crea un archivo .env en la raíz del proyecto.

Ejemplo de la estructura requerida:

```bash
# Puerto del Servidor (Por defecto: 5000)
PORT=5000

# Cadena de conexión a MongoDB
MONGO_URI=mongodb://127.0.0.1:27017/doggyeats

# Semilla secreta para encriptar los JWT (Cámbiala en producción)
JWT_SECRET=tu_super_secreto_aqui

# Credenciales de Email (Para enviar newsletter mediante Nodemailer)
EMAIL_USER=tu_correo@gmail.com
EMAIL_PASS=tu_contraseña_de_aplicacion_gmail
```
(Nota: Transbank está configurado por defecto en el entorno Environment.Integration. Para paso a producción, se requerirán las llaves CC y API keys definitivas).

👨‍💻 Autor
codesjosh 💻 Desarrollo principal
