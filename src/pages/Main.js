// Main.js

import React from 'react';
import Header from '../components/Header';
import Home from '../components/Home';
import Experience from '../components/Experience';
import Footer from '../components/Footer';

const Main = () => {
    return (
        <div className="main">
            <Header />
            <Home />
            {/*<Skills />*/}
            <Experience />
            <Footer />
        </div>
    );
};

export default Main;
