import express from 'express';
import cors from 'cors';
import { marketRouter } from './routes/markets';

const app = express();
app.use(cors());
app.use(express.json());

// API Endpoints
app.use('/api/markets', marketRouter);

app.get('/api/health', (req, res) => {
  res.status(200).json({ status: "Probabylon API is online." });
});

// Serverless Export
if (process.env.NODE_ENV !== 'production') {
  const PORT = process.env.PORT || 3001;
  app.listen(PORT, () => console.log(`API pulse detected on port ${PORT}`));
}

export default app;