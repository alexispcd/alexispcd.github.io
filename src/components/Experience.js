// Experience.js

import React from 'react';
import Timeline from '@mui/lab/Timeline';
import TimelineItem from '@mui/lab/TimelineItem';
import TimelineSeparator from '@mui/lab/TimelineSeparator';
import TimelineConnector from '@mui/lab/TimelineConnector';
import TimelineContent from '@mui/lab/TimelineContent';
import TimelineOppositeContent from '@mui/lab/TimelineOppositeContent';
import TimelineDot from '@mui/lab/TimelineDot';
import Typography from '@mui/material/Typography';
import RestaurantIcon from '@mui/icons-material/Restaurant';
import DirectionsCarIcon from '@mui/icons-material/DirectionsCar';
import ComputerIcon from '@mui/icons-material/Computer';
import Education from "./Education";
import Fade from 'react-reveal/Fade';

const Experience = () => {
    // Sample data for work experience
    const experienceData = [
        {
            company: 'Imagina',
            position: 'Développeur web',
            period: 'Septembre 2022 - Aujourd\'hui',
            responsibilities: [
                'Developing and maintaining web applications. ',
                'Collaborating with cross-functional teams on projects. ',
                'Implementing new features and functionality. ',
            ],
            icon: <ComputerIcon/>
        },
        {
            company: 'JPA',
            position: 'Agent de service',
            period: 'Juillet 2022',
            responsibilities: [
                'Developing and maintaining web applications. ',
                'Collaborating with cross-functional teams on projects. ',
                'Implementing new features and functionality. ',
            ],
            icon: <RestaurantIcon/>
        },
        {
            company: 'JPA',
            position: 'Agent de service',
            period: 'Juillet 2021 - Août 2021',
            responsibilities: [
                'Developing and maintaining web applications. ',
                'Collaborating with cross-functional teams on projects. ',
                'Implementing new features and functionality. ',
            ],
            icon: <RestaurantIcon/>
        },
        {
            company: 'Armorique Lavage Express',
            position: 'Agent de service',
            period: 'Juillet 2020 - Août 2020',
            responsibilities: [
                'Creating responsive user interfaces. ',
                'Optimizing website performance and user experience. ',
                'Collaborating with UX/UI designers. ',
            ],
            icon: <DirectionsCarIcon/>
        },
    ];
    
    return (
        <div className="experience" id="experience">
            <h2 className="section-title">Expériences</h2>
            <Timeline position="alternate-reverse" className="jobs-container">
                {experienceData.map((job, index) => (
                    <TimelineItem>
                        <TimelineOppositeContent
                            sx={{ m: 'auto 0' }}
                            align="right"
                            variant="body2"
                            color="text.secondary"
                        >
                            <Fade key={index} left={index % 2 !== 0} right={index % 2 === 0}>
                                {job.period}
                            </Fade>
                        </TimelineOppositeContent>
                        <TimelineSeparator>
                            <TimelineConnector />
                            <TimelineDot>
                                {job.icon}
                            </TimelineDot>
                            <TimelineConnector />
                        </TimelineSeparator>
                        <TimelineContent sx={{ py: '12px', px: 2 }}>
                            <Fade key={index} left={index % 2 === 0} right={index % 2 !== 0}>
                                <Typography variant="h6" component="span">
                                    {job.position} <span> - {job.company}</span>
                                </Typography>
                                <Typography>{job.responsibilities}</Typography>
                            </Fade>
                        </TimelineContent>
                    </TimelineItem>
                ))}
            </Timeline>
            <Education/>
        </div>
    );
};

export default Experience;
