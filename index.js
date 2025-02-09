import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import authRoutes from './routes/auth.routes.js'; 

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({
  origin: process.env.FRONTEND_URL,
  credentials: true,
}));
app.use(cookieParser());
app.use(express.json());

app.use('/api/auth', authRoutes);

// New route to display a message in the browser
app.get('/', (req, res) => {
    res.send('<p>generated successfully.</p>');
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 