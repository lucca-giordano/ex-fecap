import React from 'react';
import LoginPage from '../pages/LoginPage';
import ItemsPage from '../pages/ItemsPage';
import Dashboard from './DashboardList';
import NavBar from './NavBar';
import { BrowserRouter, Route, Routes } from 'react-router-dom';

const AppRoutes = () => {
        <BrowserRouter>
        <NavBar />
            <div>
                <Routes>
                    <Route path='/' element={<LoginPage/>}></Route>
                    <Route path='/dashboard' element={<ItemsPage/>}></Route>
                    <Route path='/items' element={<LoginPage/>}></Route>
                </Routes>
            </div>
        </BrowserRouter>
        
}