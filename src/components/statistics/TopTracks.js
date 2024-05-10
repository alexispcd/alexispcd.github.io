import React, {useEffect, useState} from 'react';
import {
    Avatar,
    Card,
    FormControl, InputLabel, MenuItem, Select,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow
} from "@mui/material";
import {getCurrentUserTopTracks} from "../../api/getApi";
import {msToTime} from "../../utils";
import TableLoader from "../utils/TableLoader";

const TopTracks = ({ token }) => {
    const [trackList, setTrackList] = useState([])
    const [timeRange, setTimeRange] = useState('long_term')
    const [loading, setLoading] = useState(false)
    
    useEffect(() => {
        setLoading(true)
        if (token) {
            getCurrentUserTopTracks(token, timeRange).then(data => {
                setTrackList(data)
                setLoading(false)
            })
        } else {
            setTrackList([])
        }
    }, [token, timeRange])
    
    const handleChange = (event) => {
        setTimeRange(event.target.value);
    }
    
    return (
        <Card className="statistics-card" elevation={24}>
            <FormControl>
                <InputLabel id="demo-simple-select-label">Time Range</InputLabel>
                <Select
                    labelId="demo-simple-select-label"
                    id="demo-simple-select"
                    value={timeRange}
                    label="Age"
                    onChange={handleChange}
                >
                    <MenuItem value="short_term">Short term</MenuItem>
                    <MenuItem value="medium_term">Medium term</MenuItem>
                    <MenuItem value="long_term">Long term</MenuItem>
                </Select>
            </FormControl>
            <TableContainer>
                <Table>
                    <TableHead>
                        <TableRow>
                            <TableCell>Cover</TableCell>
                            <TableCell>Title</TableCell>
                            <TableCell>Artist(s)</TableCell>
                            <TableCell>Album</TableCell>
                            <TableCell>Duration</TableCell>
                            <TableCell>Popularity</TableCell>
                        </TableRow>
                    </TableHead>
                    {loading ?
                        <TableLoader colNumber={6}/>
                        :
                        <TableBody>
                            {trackList.items && trackList.items.map((track, index) => (
                                <TableRow key={track.id} sx={{ '&:last-child td, &:last-child th': { border: 0 } }}>
                                    <TableCell>
                                        <Avatar sx={{ width: 56, height: 56 }} src={track.album.images[2].url} />
                                    </TableCell>
                                    <TableCell>{track.name}</TableCell>
                                    <TableCell>{track.artists.map(artist => artist.name)}</TableCell>
                                    <TableCell>{track.album.name}</TableCell>
                                    <TableCell>{msToTime(track.duration_ms)}</TableCell>
                                    <TableCell>{track.popularity}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    }
                </Table>
            </TableContainer>
        </Card>
    );
};

export default TopTracks;