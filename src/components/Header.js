// Header.js

import React, {useEffect, useState} from 'react';

const Header = () => {
    const [scrollPercentage, setScrollPercentage] = useState(0);
    
    useEffect(() => {
        const handleScroll = () => {
            const contentHeight = document.documentElement.scrollHeight - window.innerHeight;
            const percentage = (window.scrollY / contentHeight) * 100;
            setScrollPercentage(percentage);
        };
        
        window.addEventListener("scroll", handleScroll);
        
        // Cleanup the event listener when the component unmounts
        return () => {
            window.removeEventListener("scroll", handleScroll);
        };
    }, []);
    
    const scrollTo = (id) => {
        const element = document.getElementById(id)
        
        if (id === 'home') {
            window.scrollTo({top: 0, behavior: 'smooth'})
        } else {
            element.scrollIntoView({behavior: "smooth"})
        }
    }
    
    return (
        <header className="header">
            <div className="header-scroll-indicator" style={{ width: `${scrollPercentage + 0.2}%` }} />
            <nav className="nav">
                <ul className="nav-list">
                    <li className="nav-item"><a style={{cursor: "pointer"}} className="nav-link" onClick={() => scrollTo('home')}>Accueil</a></li>
                    <li className="nav-item"><a style={{cursor: "pointer"}} className="nav-link" onClick={() => scrollTo('about')}>À propos</a></li>
                    <li className="nav-item"><a style={{cursor: "pointer"}} className="nav-link" onClick={() => scrollTo('portfolio')}>Portfolio</a></li>
                    <li className="nav-item"><a style={{cursor: "pointer"}} className="nav-link" onClick={() => scrollTo('experience')}>Expériences</a></li>
                    <li className="nav-item"><a style={{cursor: "pointer"}} className="nav-link" onClick={() => scrollTo('education')}>Éducation</a></li>
                </ul>
            </nav>
        </header>
    );
};

export default Header;
