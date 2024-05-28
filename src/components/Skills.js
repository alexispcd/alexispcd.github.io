// Skills.js

import React from 'react';

const Skills = () => {
    // Sample skills data
    const skillsData = [
        {
            category: 'Langages',
            skills: ['JavaScript', 'HTML', 'CSS', 'Python', 'Java'],
        },
        {
            category: 'Frameworks',
            skills: ['React', 'Vue.js', 'Angular', 'Symfony'],
        },
        {
            category: 'Base de données',
            skills: ['MongoDB', 'MySQL', 'PostgreSQL'],
        },
    ];
    
    return (
        <div className="skills" id="skills">
            <h2 className="section-title">Skills</h2>
            <div className="skills-container">
                {skillsData.map((category, index) => (
                    <div key={index} className="skills-category">
                        <h3 className="skills-category-title">{category.category}</h3>
                        <ul className="skills-list">
                            {category.skills.map((skill, skillIndex) => (
                                <li key={skillIndex} className="skills-item">
                                    {skill}
                                </li>
                            ))}
                        </ul>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default Skills;
