import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import dotenv from 'dotenv';
import { rateLimit } from 'express-rate-limit';
import { notFoundHandler } from './middleware/notFoundHandler.js';
import { errorHandler } from './middleware/errorHandler.js';
import authRoutes from './modules/auth/routes.js';
import productsRouter from './modules/catalog/products/routes.js';
import templatesRouter from './modules/subscriptions/templates/routes.js';
import subscriptionsRouter from './modules/subscriptions/subscriptions/routes.js';

// Ensure environment variables are loaded
dotenv.config();

const app = express();

// Security headers
app.use(helmet());

// CORS configuration (origin from CLIENT_URL)
const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g., mobile apps, curl, server-to-server) or matching CLIENT_URL
      if (!origin || origin === clientUrl) {
        return callback(null, true);
      }
      return callback(new Error(`CORS blocked for origin: ${origin}`));
    },
    credentials: true,
  })
);

// JSON body parsing
app.use(express.json());

const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { message: 'Too many authentication requests. Please try again later.' } },
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

app.use('/api/auth', authRateLimit, authRoutes);
// Catalog routes
app.use('/api/products', productsRouter);
app.use('/api/quotation-templates', templatesRouter);
app.use('/api/subscriptions', subscriptionsRouter);

// 404 handler for unknown routes
app.use(notFoundHandler);

// Central error-handling middleware
app.use(errorHandler);

export default app;
