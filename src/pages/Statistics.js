import React from 'react';
import TopArtists from "../components/statistics/TopArtists";
import TopTracks from "../components/statistics/TopTracks";
import {Container} from "@mui/material";

const Statistics = ({ token }) => {
    return (
        <Container className="statistics">
            <TopArtists token={token}/>
            <TopTracks token={token}/>
        </Container>
    );
};

export default Statistics;