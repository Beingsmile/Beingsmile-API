# BeingSmile API

> RESTful backend powering the BeingSmile humanitarian crowdfunding platform. Built with Express 5 and MongoDB.

**Production URL:** `https://api.beingsmile.org/api/`  
**Local Dev URL:** `http://localhost:5000/api/`

---

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js 18+ |
| Framework | Express 5 |
| Database | MongoDB + Mongoose 8 |
| Authentication | Firebase Admin + JWT |
| File Storage | Cloudinary |
| Payments | Aamarpay (BDT gateway) |
| Security | Helmet, CORS, express-rate-limit |
| Validation | express-validator |
| Scheduling | node-cron |
| Logging | Morgan |

---

## Getting Started

### Prerequisites
- Node.js 18+
- MongoDB (Atlas or local)
- Cloudinary account
- Aamarpay merchant credentials
- Firebase service account

### Installation

```bash
git clone https://github.com/your-org/beingsmile-api.git
cd beingsmile-api
npm install
```

### Environment Variables

Create a `.env` file in the root:

```env
PORT=5000
MONGO_URI=mongodb+srv://...

# JWT
JWT_SECRET=your_super_secret_key
JWT_EXPIRES_IN=7d

# Firebase Admin
FIREBASE_PROJECT_ID=your_project_id
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n..."
FIREBASE_CLIENT_EMAIL=firebase-adminsdk@...

# Cloudinary
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# Aamarpay
AAMARPAY_STORE_ID=your_store_id
AAMARPAY_SIGNATURE_KEY=your_signature_key
AAMARPAY_BASE_URL=https://secure.aamarpay.com

# Frontend
CLIENT_URL=https://beingsmile.org
```

### Running

```bash
npm run dev      # Development with nodemon
npm start        # Production
```

---

## API Reference

### Base URL
```
https://api.beingsmile.org/api/
```

### Auth — `/auth`

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/auth/register` | Register a new user |
| `POST` | `/auth/login` | Login and get JWT |
| `GET` | `/auth/user/exist/:uid` | Check if Firebase UID is registered |

### Campaigns — `/campaigns`

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/campaigns` | Browse campaigns (filter, search, paginate) |
| `GET` | `/campaigns/:id` | Get single campaign |
| `POST` | `/campaigns` | Create campaign (auth required) |
| `PUT` | `/campaigns/:id` | Update campaign (owner only) |
| `DELETE` | `/campaigns/:id` | Delete campaign (owner only) |
| `POST` | `/campaigns/:id/comment` | Add comment |

### Users — `/users`

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/users/me` | Get current user profile |
| `PUT` | `/users/me` | Update profile |
| `GET` | `/users/:id/campaigns` | Get campaigns by user |
| `GET` | `/users/:id/donations` | Get donations by user |

### Payments — `/payment`

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/payment/aamarpay/initiate` | Initiate Aamarpay payment |
| `POST` | `/payment/aamarpay/success` | Aamarpay success callback |
| `POST` | `/payment/aamarpay/failure` | Aamarpay failure callback |
| `POST` | `/payment/aamarpay/cancel` | Aamarpay cancel callback |

### Verification — `/verification`

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/verification/request` | Request campaign verification |
| `GET` | `/verification/requests` | List pending verifications (admin) |

---

## Project Structure

```
src/
├── app.js              # Express app setup (CORS, middleware, routes)
├── config/             # Database and Cloudinary config
├── controllers/        # Route handler logic
│   ├── authController.js
│   ├── campaignController.js
│   ├── paymentController.js
│   ├── userController.js
│   └── verificationController.js
├── middleware/         # Auth guard, error handler
├── models/             # Mongoose schemas
│   ├── Campaign.js
│   ├── User.js
│   └── Donation.js
├── routes/             # Express routers
│   ├── authRoutes.js
│   ├── campaignRoutes.js
│   ├── paymentRoutes.js
│   ├── userRoutes.js
│   └── verificationRoutes.js
└── utils/              # Helpers (Cloudinary upload, token gen, etc.)
server.js               # Entry point
```

---

## Security

- **Helmet** — Sets secure HTTP headers
- **Rate limiting** — Prevents brute-force attacks
- **CORS** — Restricted to configured `CLIENT_URL`
- **JWT** — Short-lived access tokens for protected routes
- **express-validator** — Input sanitization on all write endpoints
