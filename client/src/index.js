import ReactDOM from 'react-dom';
import './index.css';
import { makeMainRoutes } from './routes';

require('dotenv').config();


const routes = makeMainRoutes();

ReactDOM.render(
  routes,
  document.getElementById('root')
);
