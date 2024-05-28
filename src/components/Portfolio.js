// Portfolio.js

import React, {useEffect} from 'react';
import PortfolioProject from './PortfolioProject';

const Portfolio = () => {
    
    // Sample data for projects
    const projectsData = [
        {
            title: 'Compétence 1',
            description: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.',
            technologies: ['C', 'Java', 'Python', 'HTML', 'CSS', 'JavaScript'],
            // Add more project details as needed
        },
        {
            title: 'Compétence 2',
            description: 'Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.',
            technologies: ['Python'],
            // Add more project details as needed
        },
        {
            title: 'Compétence 3',
            description: 'Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.',
            technologies: ['Vue.js', 'Firebase'],
            // Add more project details as needed
        },
        {
            title: 'Compétence 4',
            description: 'Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.',
            technologies: ['UML', 'SQL', 'Postgres'],
            // Add more project details as needed
        },
        {
            title: 'Compétence 5',
            description: 'Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.',
            technologies: ['Vue.js', 'Firebase'],
            // Add more project details as needed
        },
        {
            title: 'Compétence 6',
            description: 'Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.',
            technologies: ['Vue.js', 'Firebase'],
            // Add more project details as needed
        },
        // Add more projects as needed
    ];
    
    return (
        <section className="portfolio" id="portfolio">
            <h2 className="section-title">Portfolio</h2>
            <div className="portfolio-content">
                <div className="projects-container" >
                    {projectsData.map((project, index) => (
                        <PortfolioProject key={index} project={project} />
                    ))}
                </div>
            </div>
        </section>
    );
};

export default Portfolio;
