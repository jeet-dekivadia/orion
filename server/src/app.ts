import express from 'express';
import cors from 'cors';
import apiRoutes from './routes/api.routes';
import { config } from './config';

const app = express();

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use('/api', apiRoutes);

app.listen(config.port, () => {
  console.log(`Server running on port ${config.port}`);
}); 