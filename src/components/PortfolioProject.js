// Project.js

import React from 'react';
import Reveal from 'react-reveal/Reveal';

const PortfolioProject = ({ project }) => {
    const { title, description, technologies } = project;
    
    return (
        <Reveal effect="fadeInUp">
            <div className="project">
                <h3 className="project-title">{title}</h3>
                <p className="project-description">{description}</p>
                <div className="technologies-container">
                    <ul className="technologies-list">
                        {technologies.map((tech, index) => (
                            <li key={index} className="technology-item">
                                {tech}
                            </li>
                        ))}
                    </ul>
                </div>
            </div>
        </Reveal>
    );
};

export default PortfolioProject;
