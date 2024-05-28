// About.js

import React from 'react';
import Portfolio from "./Portfolio";

const About = () => {
    return (
        <section className="about" id="about">
            <h2 className="section-title">À propos</h2>
            <div className="about-content">
                <p className="about-description">
                    Hi, I'm Your Name, a web developer with a passion for creating innovative and
                    efficient solutions. I enjoy turning complex problems into simple, beautiful, and
                    intuitive designs.
                </p>
                <p className="about-description">
                    My technical skills include proficiency in front-end and back-end technologies,
                    as well as experience in developing responsive and user-friendly web applications.
                </p>
            </div>
            <Portfolio/>
        </section>
    );
};

export default About;
