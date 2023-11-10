import { Link } from 'react-router-dom';

function NavBar() {
  return (
    <nav>
        <ul>
            <li><Link to="/">Login</Link></li>
            <li><Link to="/dashboard">Dashboard</Link></li>
            <li><Link to="/items">Items</Link></li>
        </ul>
    </nav>
  );
}

export default NavBar;