// Education.js

import React from 'react';

const Education = () => {
    // Sample data for education
    const educationData = [
        {
            degree: 'DUT Informatique',
            institution: 'IUT de Lannion - Université de Rennes',
            period: 'Septembre 2021 - Août 2023',
        },
        {
            degree: 'Licence MIS',
            institution: 'Université Bretagne Sud - Vannes',
            period: 'Septembre 2020 - Juin 2021',
        },
        {
            degree: 'Bac S SI - Option ISN  ',
            institution: 'Lycée La Mennais - Ploërmel',
            period: 'Septembre 2017 - Juin 2020',
        },
    ];
    
    return (
        <div className="education" id="education">
            <h2 className="section-title">Education</h2>
            <div className="education-container">
                {educationData.map((education, index) => (
                    <div key={index} className="education-entry">
                        <h3 className="education-degree">{education.degree}</h3>
                        <p className="education-institution">{education.institution}</p>
                        <p className="education-period">{education.period}</p>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default Education;
