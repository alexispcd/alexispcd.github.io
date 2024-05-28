// Home.js

import React from 'react';
import About from "./About";
import {Parallax} from "react-scroll-parallax";
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import {faArrowRight} from "@fortawesome/free-solid-svg-icons";

const Home = () => {
    return (
        <>
            <Parallax speed={-50}>
                <section className="home" id="home">
                    <div className="home-image">
                        <img src="./alexis_pocard.webp" alt="Alexis Pocard"/>
                    </div>
                    <div className="home-content">
                        <h1 className="home-title">Alexis Pocard</h1>
                        <p className="home-subtitle">Développeur web</p>
                        <p className="home-description">
                            Welcome to my portfolio! I am a passionate web developer with a focus on creating
                            interactive and user-friendly experiences.
                        </p>
                        {/* Add any additional content or elements as needed */}
                        <div className="home-btn-container">
                            <a className="btn" href="#"><span>Mon CV</span><FontAwesomeIcon icon={faArrowRight} /></a>
                            <a className="btn" href="#"><span>Contact</span><FontAwesomeIcon icon={faArrowRight} /></a>
                        </div>
                    </div>
                </section>
            </Parallax>
            <About/>
        </>
    );
};

export default Home;
