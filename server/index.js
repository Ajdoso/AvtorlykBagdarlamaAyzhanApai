// Local entry point (npm start).
import app from './app.js';
import { HOST, PORT } from './config.js';

app.listen(PORT, HOST, (err) => {
  if (err) {
    console.error(err.message);
    process.exit(1);
  }
  console.log(`Сайт:   http://localhost:${PORT}`);
  console.log(`Әкімші: http://localhost:${PORT}/admin`);
});
